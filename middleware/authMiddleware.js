import jwt from "jsonwebtoken";

export const verifyToken = (req, res, next) => {
  try {
    /*
      PRIMARY AUTH SOURCE:
      Secure HttpOnly cookie.
    */

    const cookieToken = req.cookies?.ngoxi_auth;

    /*
      TEMPORARY compatibility fallback.

      We keep Bearer support while older NgoXi
      frontend files are being migrated.

      DELETE this fallback after buyer/seller/admin
      no longer use Authorization headers.
    */

    const authHeader = req.headers.authorization;

    const bearerToken = authHeader?.startsWith("Bearer ")
      ? authHeader.split(" ")[1]
      : null;

    const token = cookieToken || bearerToken;

    if (!token) {
      return res.status(401).json({
        error: "Authentication required",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      ...decoded,

      _id: decoded.id || decoded._id,
    };

    next();
  } catch (error) {
    console.error("JWT verification failed:", error.message);

    return res.status(401).json({
      error: "Invalid or expired session",
    });
  }
};
