const { utm_links, utm_tracking } = require('../db/models');
const { generateUniqueCodeWithRetry } = require('../utils/generateCode');
const { getPaginationParams, sendPaginatedResponse } = require('../utils/pagination');
const { parseUserAgent } = require('../utils/userAgentParser');
const { getIpGeolocation } = require('../utils/ipGeolocation');

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
        console.log('[UTM Tracking] Starting IP extraction and geolocation tracking');
        console.log('[UTM Tracking] Request headers:', {
            'x-forwarded-for': req.headers['x-forwarded-for'],
            'x-real-ip': req.headers['x-real-ip'],
            'cf-connecting-ip': req.headers['cf-connecting-ip'],
            'x-client-ip': req.headers['x-client-ip'],
            'user-agent': req.headers['user-agent'],
            'referer': req.headers['referer'] || req.headers['referrer']
        });
        console.log('[UTM Tracking] req.ip:', req.ip);
        console.log('[UTM Tracking] req.connection?.remoteAddress:', req.connection?.remoteAddress);
        
        // Extract IP address - prioritize headers for production (proxies/load balancers)
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

        // Extract client IP with proper priority for production environments
        let ipAddress = null;
        let ipSource = 'none';
        
        // 1. First try x-forwarded-for header (contains client IP in production with proxies)
        // The format is usually: "client-ip, proxy1-ip, proxy2-ip"
        const forwardedFor = req.headers['x-forwarded-for'];
        if (forwardedFor) {
          const ips = typeof forwardedFor === 'string' 
            ? forwardedFor.split(',').map(ip => ip.trim())
            : [forwardedFor];
          
          console.log('[UTM Tracking] x-forwarded-for IPs:', ips);
          
          // Find first non-private IP (client's real IP is usually first)
          for (const ip of ips) {
            if (ip && !isLocalhostOrPrivate(ip)) {
              ipAddress = ip;
              ipSource = 'x-forwarded-for';
              break;
            }
          }
        }
        
        // 2. Fallback to x-real-ip header (common in nginx)
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          const realIp = req.headers['x-real-ip'];
          if (realIp && !isLocalhostOrPrivate(realIp)) {
            ipAddress = realIp;
            ipSource = 'x-real-ip';
          }
        }
        
        // 3. Try cf-connecting-ip (Cloudflare)
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          const cfIp = req.headers['cf-connecting-ip'];
          if (cfIp && !isLocalhostOrPrivate(cfIp)) {
            ipAddress = cfIp;
            ipSource = 'cf-connecting-ip';
          }
        }
        
        // 4. Try x-client-ip header
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          const clientIp = req.headers['x-client-ip'];
          if (clientIp && !isLocalhostOrPrivate(clientIp)) {
            ipAddress = clientIp;
            ipSource = 'x-client-ip';
          }
        }
        
        // 5. Use req.ip (set by Express trust proxy)
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          if (req.ip && !isLocalhostOrPrivate(req.ip)) {
            ipAddress = req.ip;
            ipSource = 'req.ip';
          }
        }
        
        // 6. Final fallback to connection remote address
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
          const remoteAddress = req.connection?.remoteAddress || req.socket?.remoteAddress;
          if (remoteAddress && !isLocalhostOrPrivate(remoteAddress)) {
            ipAddress = remoteAddress;
            ipSource = 'connection.remoteAddress';
          } else if (remoteAddress) {
            // If remote address is private, use it anyway (we'll handle geolocation separately)
            ipAddress = remoteAddress;
            ipSource = 'connection.remoteAddress (private)';
          }
        }
        
        console.log('[UTM Tracking] Extracted IP:', ipAddress, 'Source:', ipSource);
        console.log('[UTM Tracking] Is localhost/private:', isLocalhostOrPrivate(ipAddress));
        
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
                console.log('[UTM Tracking] Starting geolocation lookup...');
                console.log('[UTM Tracking] IP for geolocation (before processing):', ipAddress);
                
                // Use the extracted client IP for geolocation
                // Only use server's public IP if we're actually on localhost (development/testing)
                let ipForGeolocation = ipAddress;
                const isDevelopment = process.env.NODE_ENV !== 'production';
                const isClientLocalhost = ipAddress && isLocalhostOrPrivate(ipAddress);

                console.log('[UTM Tracking] Environment:', isDevelopment ? 'development' : 'production');
                console.log('[UTM Tracking] Is client localhost:', isClientLocalhost);

                // Only fetch server's public IP if:
                // 1. We're in development AND the client IP is localhost
                // 2. This ensures we don't replace real client IPs in production
                if (isDevelopment && isClientLocalhost && ipAddress) {
                    try {
                        console.log('[UTM Tracking] [DEV] Attempting to get server public IP...');
                        // Dynamic import for ES module (public-ip v8+)
                        const { publicIpv4 } = await import('public-ip');
                        
                        // Try to get server's public IP with timeout (for local testing only)
                        const publicIpPromise = publicIpv4();
                        const timeoutPromise = new Promise((resolve) => 
                            setTimeout(() => resolve(null), 1000)
                        );
                        const publicIpResult = await Promise.race([publicIpPromise, timeoutPromise]);
                        if (publicIpResult) {
                            // Only use server IP if we confirmed client is localhost
                            ipForGeolocation = publicIpResult;
                            console.log(`[UTM Tracking] [DEV] Using server's public IP ${publicIpResult} for geolocation (client was localhost: ${ipAddress})`);
                        } else {
                            console.log('[UTM Tracking] [DEV] Could not get server public IP (timeout)');
                        }
                    } catch (err) {
                        // If we can't get public IP, use the original IP (geolocation might fail, that's okay)
                        console.warn('[UTM Tracking] Could not get server public IP for geolocation:', err.message);
                    }
                } else {
                    console.log('[UTM Tracking] Using client IP for geolocation (not fetching server IP)');
                }
                // In production: always use the client's IP, even if private (headers should provide public IP)
                
                console.log('[UTM Tracking] Final IP for geolocation:', ipForGeolocation);
                
                // Try to get geolocation with a short timeout (1.5 seconds max)
                let geoData = { 
                    full: null,
                    country: null, 
                    city: null 
                };
                if (ipForGeolocation) {
                    try {
                        console.log('[UTM Tracking] Calling getIpGeolocation with IP:', ipForGeolocation);
                        const geoPromise = getIpGeolocation(ipForGeolocation);
                        const timeoutPromise = new Promise((resolve) => 
                            setTimeout(() => resolve({ 
                                full: null,
                                country: null, 
                                city: null 
                            }), 1500)
                        );
                        geoData = await Promise.race([geoPromise, timeoutPromise]);
                        console.log('[UTM Tracking] Geolocation result:', {
                            country: geoData.country,
                            city: geoData.city,
                            hasFullData: !!geoData.full
                        });
                        if (geoData.full) {
                            console.log('[UTM Tracking] Full geodata sample:', {
                                country: geoData.full.country_code,
                                country_name: geoData.full.country_name,
                                city: geoData.full.city,
                                region: geoData.full.region
                            });
                        }
                    } catch (err) {
                        // Ignore geolocation errors - don't block tracking
                        console.error('[UTM Tracking] Geolocation error (non-blocking):', err.message);
                    }
                } else {
                    console.warn('[UTM Tracking] No IP available for geolocation');
                }

                // Create tracking record with all available data including full geodata
                const trackingData = {
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
                };
                
                console.log('[UTM Tracking] Creating tracking record with data:', {
                    utm_link_id: trackingData.utm_link_id,
                    code: trackingData.code,
                    ip_address: trackingData.ip_address,
                    country: trackingData.country,
                    city: trackingData.city,
                    has_geodata: !!trackingData.geodata,
                    device_type: trackingData.device_type,
                    browser: trackingData.browser,
                    os: trackingData.os
                });
                
                const trackingRecord = await utm_tracking.create(trackingData);
                console.log('[UTM Tracking] Tracking record created successfully with ID:', trackingRecord.id);
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