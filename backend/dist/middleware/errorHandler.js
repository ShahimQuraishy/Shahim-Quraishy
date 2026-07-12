export const errorHandler = (err, _req, res, _next) => {
    res.status(500).json({
        message: 'Internal server error',
        details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
};
