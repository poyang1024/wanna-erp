// Restricted users who only have access to specific pages
export const restrictedUsers = [
    'sabrina.huang@kindfoodtw.com',
    'kindfood_support@kindfoodtw.com',
    'design@kindfoodtw.com',
    'business@kindfoodtw.com',
    'marketing@kindfoodtw.com',
    'logistics@kindfoodtw.com',
    'service@kindfoodtw.com',
    'yun.tung@kindfoodtw.com',
    'james01030103@gmail.com',
    'tom555000222@gmail.com',
];

// Pages that restricted users can access
export const allowedPaths = [
    '/saved-pricing',
    '/shipping',
    '/dealer-pricing', 
    '/order-cost-rate',
    '/',
    '/profile',
    '/signin'
];

// Helper function to check if a user is restricted
export const isRestrictedUser = (email) => {
    return restrictedUsers.includes(email);
};

// Helper function to check if a path is allowed for restricted users
export const isAllowedPath = (path) => {
    return allowedPaths.includes(path);
};