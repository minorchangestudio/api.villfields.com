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

        // 0. FIRST PRIORITY: Custom header from Next.js (x-client-real-ip)
        // This is set by Next.js with the real client IP and won't be overwritten by internal proxies
        const clientRealIp = req.headers['x-client-real-ip'];
        if (clientRealIp && !isLocalhostOrPrivate(clientRealIp)) {
            ipAddress = clientRealIp;
            ipSource = 'x-client-real-ip (from Next.js)';
        }

        // 1. Try x-forwarded-for header (contains client IP in production with proxies)
        // The format is usually: "client-ip, proxy1-ip, proxy2-ip"
        // Only check this if we didn't get IP from x-client-real-ip
        if (!ipAddress || isLocalhostOrPrivate(ipAddress)) {
            const forwardedFor = req.headers['x-forwarded-for'];
            if (forwardedFor) {
                const ips = typeof forwardedFor === 'string'
                    ? forwardedFor.split(',').map(ip => ip.trim())
                    : [forwardedFor];

                // Find first non-private IP (client's real IP is usually first)
                for (const ip of ips) {
                    if (ip && !isLocalhostOrPrivate(ip)) {
                        ipAddress = ip;
                        ipSource = 'x-forwarded-for';
                        break;
                    }
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
                // Use the extracted client IP for geolocation
                // Only use server's public IP if we're actually on localhost (development/testing)
                let ipForGeolocation = ipAddress;
                const isDevelopment = process.env.NODE_ENV !== 'production';
                const isClientLocalhost = ipAddress && isLocalhostOrPrivate(ipAddress);

                // Only fetch server's public IP if:
                // 1. We're in development AND the client IP is localhost
                // 2. This ensures we don't replace real client IPs in production
                if (isDevelopment && isClientLocalhost && ipAddress) {
                    try {
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
                        }
                    } catch (err) {
                        // If we can't get public IP, use the original IP (geolocation might fail, that's okay)
                        console.warn('Could not get server public IP for geolocation:', err.message);
                    }
                }
                // In production: always use the client's IP, even if private (headers should provide public IP)

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


// updateUtmLink
const updateUtmLink = async (req, res) => {
    try {
        const { id } = req.params;
        const { destinationUrl, utmSource, utmMedium, utmCampaign, utmContent } = req.body;

        const utmLink = await utm_links.findOne({
            where: { id }
        });

        if (!utmLink) {
            return res.status(404).json({ message: "UTM link not found" });
        }

        utmLink.destination_url = destinationUrl;
        utmLink.utm_source = utmSource;
        utmLink.utm_medium = utmMedium;
        utmLink.utm_campaign = utmCampaign;
        utmLink.utm_content = utmContent;
        await utmLink.save();

        return res.status(200).json({ message: "UTM link updated successfully" });
    } catch (error) {
        console.error('Error updating UTM link:', error);
        res.status(500).json({ message: "Error updating utm link", error: error.message });
    }
}

// deleteUtmLink
const deleteUtmLink = async (req, res) => {
    try {
        const { id } = req.params;
        const utmLink = await utm_links.findOne({
            where: { id }
        });

        if (!utmLink) {
            return res.status(404).json({ message: "UTM link not found" });
        }

        await utmLink.destroy();

        return res.status(200).json({ message: "UTM link deleted successfully" });
    } catch (error) {
        console.error('Error deleting UTM link:', error);
        res.status(500).json({ message: "Error deleting utm link", error: error.message });
    }
}
const getUtmLinkAnalytics = async (req, res) => {
    try {
        const { code } = req.params;

        if (!code) {
            return res.status(400).json({ message: "Code parameter is required" });
        }

        // Find UTM link by code
        const utmLink = await utm_links.findOne({
            where: { code }
        });

        if (!utmLink) {
            return res.status(404).json({ message: "UTM link not found" });
        }

        // Get all tracking data for this link
        const trackingData = await utm_tracking.findAll({
            where: { utm_link_id: utmLink.id },
            order: [['clicked_at', 'ASC']]
        });

        // Calculate overview stats
        const totalClicks = trackingData.length;
        const uniqueIPs = new Set(trackingData.map(t => t.ip_address).filter(Boolean)).size;
        const uniqueCountries = new Set(trackingData.map(t => t.country).filter(Boolean)).size;

        // Time series data (clicks per day)
        const timeSeriesMap = new Map();
        trackingData.forEach(track => {
            const date = new Date(track.clicked_at).toISOString().split('T')[0];
            timeSeriesMap.set(date, (timeSeriesMap.get(date) || 0) + 1);
        });
        const timeSeries = Array.from(timeSeriesMap.entries())
            .map(([date, clicks]) => ({ date, clicks }))
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        // Country distribution
        const countryMap = new Map();
        trackingData.forEach(track => {
            const country = track.country || 'Unknown';
            countryMap.set(country, (countryMap.get(country) || 0) + 1);
        });
        const countryDistribution = Array.from(countryMap.entries())
            .map(([country, count]) => ({ country, count }))
            .sort((a, b) => b.count - a.count);

        // City distribution
        const cityMap = new Map();
        trackingData.forEach(track => {
            const city = track.city || 'Unknown';
            const key = `${city}${track.country ? `, ${track.country}` : ''}`;
            cityMap.set(key, (cityMap.get(key) || 0) + 1);
        });
        const cityDistribution = Array.from(cityMap.entries())
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 cities

        // Device type distribution
        const deviceMap = new Map();
        trackingData.forEach(track => {
            const device = track.device_type || 'Unknown';
            deviceMap.set(device, (deviceMap.get(device) || 0) + 1);
        });
        const deviceDistribution = Array.from(deviceMap.entries())
            .map(([device, count]) => ({ device, count }))
            .sort((a, b) => b.count - a.count);

        // Browser distribution
        const browserMap = new Map();
        trackingData.forEach(track => {
            const browser = track.browser || 'Unknown';
            browserMap.set(browser, (browserMap.get(browser) || 0) + 1);
        });
        const browserDistribution = Array.from(browserMap.entries())
            .map(([browser, count]) => ({ browser, count }))
            .sort((a, b) => b.count - a.count);

        // OS distribution
        const osMap = new Map();
        trackingData.forEach(track => {
            const os = track.os || 'Unknown';
            osMap.set(os, (osMap.get(os) || 0) + 1);
        });
        const osDistribution = Array.from(osMap.entries())
            .map(([os, count]) => ({ os, count }))
            .sort((a, b) => b.count - a.count);

        // Referer distribution
        const refererMap = new Map();
        trackingData.forEach(track => {
            const referer = track.referer || 'Direct';
            refererMap.set(referer, (refererMap.get(referer) || 0) + 1);
        });
        const refererDistribution = Array.from(refererMap.entries())
            .map(([referer, count]) => ({ referer, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10); // Top 10 referers

        // Hourly distribution (clicks per hour of day)
        const hourlyMap = new Map();
        for (let i = 0; i < 24; i++) {
            hourlyMap.set(i, 0);
        }
        trackingData.forEach(track => {
            const hour = new Date(track.clicked_at).getHours();
            hourlyMap.set(hour, (hourlyMap.get(hour) || 0) + 1);
        });
        const hourlyDistribution = Array.from(hourlyMap.entries())
            .map(([hour, count]) => ({ hour: parseInt(hour), count }))
            .sort((a, b) => a.hour - b.hour);

        // Weekly distribution (clicks per day of week)
        const weeklyMap = new Map();
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        days.forEach(day => weeklyMap.set(day, 0));
        trackingData.forEach(track => {
            const day = days[new Date(track.clicked_at).getDay()];
            weeklyMap.set(day, (weeklyMap.get(day) || 0) + 1);
        });
        const weeklyDistribution = Array.from(weeklyMap.entries())
            .map(([day, count]) => ({ day, count }));

        res.status(200).json({
            status: "success",
            data: {
                link: {
                    id: utmLink.id,
                    code: utmLink.code,
                    destinationUrl: utmLink.destination_url,
                    utmSource: utmLink.utm_source,
                    utmMedium: utmLink.utm_medium,
                    utmCampaign: utmLink.utm_campaign,
                    utmContent: utmLink.utm_content,
                    isActive: utmLink.is_active,
                    createdAt: utmLink.created_at
                },
                overview: {
                    totalClicks,
                    uniqueIPs,
                    uniqueCountries
                },
                timeSeries,
                countryDistribution,
                cityDistribution,
                deviceDistribution,
                browserDistribution,
                osDistribution,
                refererDistribution,
                hourlyDistribution,
                weeklyDistribution
            }
        });
    } catch (error) {
        console.error('Error fetching UTM link analytics:', error);
        res.status(500).json({
            status: "error",
            message: "Error fetching analytics",
            error: error.message
        });
    }
}

module.exports = { createUtmLink, getUtmLinks, redirectUtmLink, updateUtmLink, deleteUtmLink, getUtmLinkAnalytics };