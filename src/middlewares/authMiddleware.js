const { verifyToken } = require("@clerk/clerk-sdk-node");



const publicRoutes = [
  '/v1/utm-links',
  '/v1/utm-links/redirect',
];



const clerkAuthMiddleware = async (req, res, next) => {
  try {
    // If the route is public, skip authentication
    // Check if path starts with any public route (for dynamic routes like /redirect/:code)
    const isPublicRoute = publicRoutes.some(route => req.path === route || req.path.startsWith(route + '/'));
    
    if (isPublicRoute) {
      return next();
    }

    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const token = authHeader.split(" ")[1];

    // Verify Clerk token
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    // Attach user to request
    req.user = {
      id: payload.sub,               // Clerk userId
      email: payload.email,
      firstName: payload.given_name,
      lastName: payload.family_name,
    };

    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};

module.exports = clerkAuthMiddleware;