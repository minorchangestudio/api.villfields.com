/**
 * IP Geolocation Utility
 * Gets full geolocation information from IP address
 * Uses free service: ipapi.co
 */

/**
 * Get geolocation data from IP address
 * @param {string} ipAddress - IP address (IPv4 or IPv6)
 * @returns {Promise<Object>} Full geolocation data object with country, city, and all fields
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

  // Remove IPv6 mapping prefix ::ffff: if present (e.g., ::ffff:10.0.1.14 -> 10.0.1.14)
  if (cleanIp && cleanIp.startsWith('::ffff:')) {
    cleanIp = cleanIp.replace(/^::ffff:/, '')
  }

  // If no IP, return null (but don't skip private IPs - controller handles getting public IP)
  if (!cleanIp) {
    return {
      full: null,
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
      return { 
        full: null,
        country: null, 
        city: null 
      }
    }

    const data = await response.json()

    // Handle error responses from ipapi.co
    if (data.error) {
      return { 
        full: null,
        country: null, 
        city: null 
      }
    }

    // Return full geolocation data object along with extracted country and city
    // Extract country from country_code (ISO 2-letter) or country_code_iso3
    const countryCode = data.country_code || data.country_code_iso3?.substring(0, 2) || null
    const city = data.city || null

    return {
      full: data, // Store the complete geolocation object
      country: countryCode, // ISO 2-letter country code for backward compatibility
      city: city
    }
  } catch (error) {
    // Silently fail - don't block redirect if geolocation fails
    console.error('IP geolocation error:', error.message)
    return {
      full: null,
      country: null,
      city: null
    }
  }
}

module.exports = {
  getIpGeolocation
}
