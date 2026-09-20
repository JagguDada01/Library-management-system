function validateRegistration(data) {
  const errors = [];

  const name = (data.name || '').trim();
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';

  if (!name || name.length < 2) {
    errors.push('Full name must be at least 2 characters long');
  } else if (name.length > 100) {
    errors.push('Full name cannot exceed 100 characters');
  }

  const emailRegex = /^\S+@\S+\.\S+$/;
  if (!email || !emailRegex.test(email)) {
    errors.push('Please enter a valid email address');
  }

  if (!password || password.length < 6) {
    errors.push('Password must be at least 6 characters long');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: {
      name,
      email,
      password
      // Note: intentionally discarding any submitted 'role' field (Edge Case 9)
    }
  };
}

function validateLogin(data) {
  const errors = [];
  const email = (data.email || '').trim().toLowerCase();
  const password = data.password || '';

  if (!email) {
    errors.push('Email is required');
  }
  if (!password) {
    errors.push('Password is required');
  }

  return {
    isValid: errors.length === 0,
    errors,
    sanitized: { email, password }
  };
}

module.exports = {
  validateRegistration,
  validateLogin
};
