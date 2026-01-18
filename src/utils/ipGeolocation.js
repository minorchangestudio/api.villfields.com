/**
 * IP Geolocation Utility
 * Gets country and city information from IP address
 * Uses free service: ipapi.co
 */

/**
 * Get geolocation data from IP address
 * @param {string} ipAddress - IP address (IPv4 or IPv6)
 * @returns {Promise<Object>} Geolocation data { country, city }
 */
const getIpGeolocation = async (ipAddress) => {
  // Clean IP address (remove port if present, handle IPv6)
  let cleanIp = ipAddress
  
  // Handle IPv6 with port: [::1]:1234 -> ::1
  if (cleanIp && cleanIp.includes('[') && cleanIp.includes(']')) {
    cleanIp = cleanIp.match(/\[([^\]]+)\]/)?.[1] || cleanIp
  }
  
  // Handle IPv4 with port: 192.168.1.1:1234 -> 192.168.1.1
  if (cleanIp && cleanIp.includes(':') && !cleanIp.includes('::')) {
    cleanIp = cleanIp.split(':')[0]
  }

  // Skip local/private IPs
  if (!cleanIp || 
      cleanIp === '::1' || 
      cleanIp === '127.0.0.1' || 
      cleanIp.startsWith('192.168.') || 
      cleanIp.startsWith('10.') || 
      cleanIp.startsWith('172.16.') ||
      cleanIp.startsWith('172.17.') ||
      cleanIp.startsWith('172.18.') ||
      cleanIp.startsWith('172.19.') ||
      cleanIp.startsWith('172.20.') ||
      cleanIp.startsWith('172.21.') ||
      cleanIp.startsWith('172.22.') ||
      cleanIp.startsWith('172.23.') ||
      cleanIp.startsWith('172.24.') ||
      cleanIp.startsWith('172.25.') ||
      cleanIp.startsWith('172.26.') ||
      cleanIp.startsWith('172.27.') ||
      cleanIp.startsWith('172.28.') ||
      cleanIp.startsWith('172.29.') ||
      cleanIp.startsWith('172.30.') ||
      cleanIp.startsWith('172.31.') ||
      cleanIp === 'localhost') {
    return {
      country: null,
      city: null
    }
  }

  try {
    // Use free ipapi.co service (no API key required for basic usage)
    // Rate limit: 1000 requests/day for free tier
    const response = await fetch(`http://ipapi.co/${cleanIp}/json/`, {
      method: 'GET',
      headers: {
        'User-Agent': 'VillFields-API/1.0'
      },
      // Set timeout to avoid blocking redirect
      signal: AbortSignal.timeout(2000) // 2 second timeout
    })

    if (!response.ok) {
      return { country: null, city: null }
    }

    const data = await response.json()

    // Handle error responses from ipapi.co
    if (data.error) {
      return { country: null, city: null }
    }

    return {
      country: data.country_code || null, // ISO 2-letter country code
      city: data.city || null
    }
  } catch (error) {
    // Silently fail - don't block redirect if geolocation fails
    console.error('IP geolocation error:', error.message)
    return {
      country: null,
      city: null
    }
  }
}

module.exports = {
  getIpGeolocation
}
