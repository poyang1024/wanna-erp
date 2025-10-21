// Get restricted users from environment variable
const getRestrictedUsers = () => {
    const envUsers = process.env.REACT_APP_RESTRICTED_USERS;
    if (!envUsers) {
        console.warn('REACT_APP_RESTRICTED_USERS not set in environment variables');
        return [];
    }
    return envUsers.split(',').map(email => email.trim()).filter(email => email);
};

// Get allowed paths from environment variable
const getAllowedPaths = () => {
    const envPaths = process.env.REACT_APP_ALLOWED_PATHS;
    if (!envPaths) {
        console.warn('REACT_APP_ALLOWED_PATHS not set in environment variables');
        return ['/signin', '/profile']; // Default minimal paths
    }
    return envPaths.split(',').map(path => path.trim()).filter(path => path);
};

// Restricted users who only have access to specific pages
export const restrictedUsers = getRestrictedUsers();

// Pages that restricted users can access
export const allowedPaths = getAllowedPaths();

// Helper function to check if a user is restricted
export const isRestrictedUser = (email) => {
    return restrictedUsers.includes(email);
};

// Helper function to check if a path is allowed for restricted users
export const isAllowedPath = (path) => {
    return allowedPaths.includes(path);
};