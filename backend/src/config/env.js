

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in the environment variables.');
    console.error('The server cannot start without a secure JWT_SECRET.');
    process.exit(1);
}

module.exports = {
    JWT_SECRET
};
