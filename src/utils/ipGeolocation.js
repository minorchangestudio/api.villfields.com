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
  console.log('[ipGeolocation] Starting geolocation lookup for IP:', ipAddress)
  
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

  console.log('[ipGeolocation] Cleaned IP:', cleanIp)

  // If no IP, return null (but don't skip private IPs - controller handles getting public IP)
  if (!cleanIp) {
    console.warn('[ipGeolocation] No IP address provided')
    return {
      full: null,
      country: null,
      city: null
    }
  }

  try {
    // Use free ipapi.co service (no API key required for basic usage)
    // Rate limit: 1000 requests/day for free tier
    const apiUrl = `http://ipapi.co/${cleanIp}/json/`
    console.log('[ipGeolocation] Calling API:', apiUrl)
    
    const response = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'VillFields-API/1.0'
      },
      // Set timeout to avoid blocking redirect
      signal: AbortSignal.timeout(2000) // 2 second timeout
    })

    console.log('[ipGeolocation] API response status:', response.status)

    if (!response.ok) {
      console.error('[ipGeolocation] API response not OK:', response.status, response.statusText)
      return { 
        full: null,
        country: null, 
        city: null 
      }
    }

    const data = await response.json()
    console.log('[ipGeolocation] API response data:', data)

    // Handle error responses from ipapi.co
    if (data.error) {
      console.error('[ipGeolocation] API returned error:', data.error)
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

    console.log('[ipGeolocation] Extracted country:', countryCode, 'city:', city)
    console.log('[ipGeolocation] Full geodata keys:', Object.keys(data))

    const result = {
      full: data, // Store the complete geolocation object
      country: countryCode, // ISO 2-letter country code for backward compatibility
      city: city
    }
    
    console.log('[ipGeolocation] Returning result:', {
      hasFullData: !!result.full,
      country: result.country,
      city: result.city
    })

    return result
  } catch (error) {
    // Log error but don't block redirect
    console.error('[ipGeolocation] Error during geolocation lookup:', error.message)
    console.error('[ipGeolocation] Error stack:', error.stack)
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
