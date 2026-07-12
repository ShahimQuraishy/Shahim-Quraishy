export const requireApiKey = (expected) => (req, res, next) => {
    if (req.header('x-api-key') !== expected) {
        res.status(401).json({ message: 'Unauthorized' });
        return;
    }
    next();
};
