const { utm_links, utm_tracking } = require('../db/models');
const { generateUniqueCodeWithRetry } = require('../utils/generateCode');
const { getPaginationParams, sendPaginatedResponse } = require('../utils/pagination');
const { parseUserAgent } = require('../utils/userAgentParser');
const { getIpGeolocation } = require('../utils/ipGeolocation');
const {publicIpv4} = require('public-ip');

const getUtmLinks = async (req, res) => {
    try {
        // Get pagination parameters
        const { page, limit, offset } = getPaginationParams(req.query, {
            defaultPage: 1,
            defaultLimit: 10,
            maxLimit: 100
        });

        // Fetch paginated UTM links
        const result = await utm_links.findAndCountAll({
            order: [['created_at', 'DESC']],
            limit,
            offset
        });

        // Send paginated response
        return sendPaginatedResponse(res, result, page, limit, {
            status: "success",
            message: "UTM links retrieved successfully"
        });
    } catch (error) {
        res.status(500).json({ 
            status: "error",
            message: "Error fetching utm links", 
            error: error.message 
        });
    }
}



const createUtmLink = async (req, res) => {
    try {
        const { destinationUrl, utmSource, utmMedium, utmCampaign, utmContent } = req.body;

        // Validation
        if (!destinationUrl || !utmSource || !utmMedium) {
            return res.status(400).json({ 
                message: "Missing required fields: destinationUrl, utmSource, and utmMedium are required" 
            });
        }

        // Validate URL format
        try {
            new URL(destinationUrl);
        } catch (error) {
            return res.status(400).json({ message: "Invalid destination URL format" });
        }

        // Generate unique code
        const code = await generateUniqueCodeWithRetry(utm_links, 8);

        // Create UTM link
        const utmLink = await utm_links.create({
            code,
            destination_url: destinationUrl,
            utm_source: utmSource,
            utm_medium: utmMedium,
            utm_campaign: utmCampaign || null,
            utm_content: utmContent || null,
            is_active: true,
            created_by: req.user?.id || null
        });



        res.status(201).json({
            id: utmLink.id,
            code: utmLink.code,
            destinationUrl: utmLink.destination_url,
            utmSource: utmLink.utm_source,
            utmMedium: utmLink.utm_medium,
            utmCampaign: utmLink.utm_campaign,
            utmContent: utmLink.utm_content,
            isActive: utmLink.is_active,
            createdAt: utmLink.created_at,
            updatedAt: utmLink.updated_at
        });
    } catch (error) {
        console.error('Error creating UTM link:', error);
        res.status(500).json({ message: "Error creating utm link", error: error.message });
    }
}

const redirectUtmLink = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({ message: "Code parameter is required" });
        }

        // Find UTM link by code
        const utmLink = await utm_links.findOne({
            where: { code, is_active: true }
        });

        if (!utmLink) {
            return res.status(404).json({ message: "UTM link not found or inactive" });
        }

        // Construct destination URL with UTM parameters
        const destinationUrl = new URL(utmLink.destination_url);
        destinationUrl.searchParams.append('utm_source', utmLink.utm_source);
        destinationUrl.searchParams.append('utm_medium', utmLink.utm_medium);
        
        if (utmLink.utm_campaign) {
            destinationUrl.searchParams.append('utm_campaign', utmLink.utm_campaign);
        }
        
        if (utmLink.utm_content) {
            destinationUrl.searchParams.append('utm_content', utmLink.utm_content);
        }

        const finalUrl = destinationUrl.toString();

        // Capture request metadata for tracking
        // Extract IP address - handle production environments with proxies/load balancers
        let ipAddress = req.ip;
        
        // Helper function to check if IP is localhost or private
        const isLocalhostOrPrivate = (ip) => {
          if (!ip) return true;
          // Remove IPv6 mapping prefix if present
          const cleaned = ip.replace(/^::ffff:/, '');
          return cleaned === '::1' || 
                 cleaned === '127.0.0.1' || 
                 cleaned === 'localhost' ||
                 cleaned.startsWith('192.168.') || 
                 cleaned.startsWith('10.') || 
                 cleaned.startsWith('172.16.') ||
                 cleaned.startsWith('172.17.') ||
                 cleaned.startsWith('172.18.') ||
                 cleaned.startsWith('172.19.') ||
                 cleaned.startsWith('172.20.') ||
                 cleaned.startsWith('172.21.') ||
                 cleaned.startsWith('172.22.') ||
                 cleaned.startsWith('172.23.') ||
                 cleaned.startsWith('172.24.') ||
                 cleaned.startsWith('172.25.') ||
                 cleaned.startsWith('172.26.') ||
                 cleaned.startsWith('172.27.') ||
                 cleaned.startsWith('172.28.') ||
                 cleaned.startsWith('172.29.') ||
                 cleaned.startsWith('172.30.') ||
                 cleaned.startsWith('172.31.');
        };
        
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          // Try x-forwarded-for header (first IP in comma-separated list)
          const forwardedFor = req.headers['x-forwarded-for'];
          if (forwardedFor) {
            const firstIp = typeof forwardedFor === 'string' 
              ? forwardedFor.split(',')[0].trim() 
              : forwardedFor[0];
            if (firstIp && !isLocalhostOrPrivate(firstIp)) {
              ipAddress = firstIp;
            }
          }
        }
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          // Fallback to x-real-ip header
          const realIp = req.headers['x-real-ip'];
          if (realIp && !isLocalhostOrPrivate(realIp)) {
            ipAddress = realIp;
          }
        }
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          // Final fallback to connection remote address
          const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
          if (remoteAddress && !isLocalhostOrPrivate(remoteAddress)) {
            ipAddress = remoteAddress;
          }
        }
        
        // Store original IP for reference
        const originalIpAddress = ipAddress;
        
        const userAgent = req.headers['user-agent'] || null;
        const referer = req.headers['referer'] || req.headers['referrer'] || null;

        // Parse user agent to extract device type, browser, and OS
        const { deviceType, browser, os } = parseUserAgent(userAgent);

        // Debug logging (remove in production if needed)
        if (!userAgent) {
            console.warn('No user-agent header received for tracking');
        }

        // Create tracking record (async, don't wait for it)
        // Gets geolocation with timeout to avoid blocking redirect
        const createTrackingRecord = async () => {
            try {
                // If IP is localhost/private, try to get public IP for geolocation
                let ipForGeolocation = ipAddress;

                console.log(ipForGeolocation)


                if (ipAddress && isLocalhostOrPrivate(ipAddress)) {
                    try {
                        // Try to get public IP with timeout
                        const publicIpPromise = publicIpv4();
                        const timeoutPromise = new Promise((resolve) => 
                            setTimeout(() => resolve(null), 1000)
                        );
                        const publicIpResult = await Promise.race([publicIpPromise, timeoutPromise]);
                        if (publicIpResult) {
                            ipForGeolocation = publicIpResult;
                            // console.log(`Using public IP ${publicIpResult} for geolocation (original: ${ipAddress})`);
                        }
                    } catch (err) {
                        // If we can't get public IP, still try with localhost IP (might fail, but that's okay)
                        console.warn('Could not get public IP for geolocation:', err.message);
                    }
                }
                
                // Try to get geolocation with a short timeout (1.5 seconds max)
                let geoData = { 
                    full: null,
                    country: null, 
                    city: null 
                };
                if (ipForGeolocation) {
                    try {
                        const geoPromise = getIpGeolocation(ipForGeolocation);
                        const timeoutPromise = new Promise((resolve) => 
                            setTimeout(() => resolve({ 
                                full: null,
                                country: null, 
                                city: null 
                            }), 1500)
                        );
                        geoData = await Promise.race([geoPromise, timeoutPromise]);
                    } catch (err) {
                        // Ignore geolocation errors - don't block tracking
                        console.error('Geolocation error (non-blocking):', err.message);
                    }
                }

                // Create tracking record with all available data including full geodata
                await utm_tracking.create({
                    utm_link_id: utmLink.id,
                    code: utmLink.code,
                    ip_address: originalIpAddress, // Store original IP from request
                    user_agent: userAgent,
                    referer: referer,
                    country: geoData.country,
                    city: geoData.city,
                    geodata: geoData.full, // Store full geolocation object (from public IP if localhost)
                    device_type: deviceType,
                    browser: browser,
                    os: os,
                    clicked_at: new Date()
                });
            } catch (err) {
                console.error('Error creating tracking record:', err);
                // Don't fail the redirect if tracking fails
            }
        };

        // Fire and forget - don't wait for tracking to complete
        createTrackingRecord();

        // Redirect user (302 - temporary redirect for tracking purposes)
        res.redirect(302, finalUrl);
    } catch (error) {
        console.error('Error redirecting UTM link:', error);
        res.status(500).json({ message: "Error processing redirect", error: error.message });
    }
}

module.exports = { createUtmLink, getUtmLinks, redirectUtmLink };