// Feature flags configuration
export const FEATURE_FLAGS = {
  // Controls the first-round popup that shows the tournament bracket image
  SHOW_FIRST_ROUND_POPUP: false,
  
  // Controls the share game popup that appears after scoring 3 baskets
  SHOW_SHARE_GAME_POPUP: false,
};

// Helper function to check if a feature flag is enabled
export const isFeatureEnabled = (flagName) => {
  return FEATURE_FLAGS[flagName] === true;
}; 