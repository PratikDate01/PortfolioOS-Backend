import dotenv from 'dotenv';
// Ensure environment variables are loaded
dotenv.config();

export const validateEnv = (): void => {
  const missingVars: string[] = [];

  const requiredVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET'];

  requiredVars.forEach((key) => {
    if (!process.env[key] || process.env[key]?.trim() === '') {
      missingVars.push(key);
    }
  });

  // Verify that JWT_SECRET does not use the default fallback
  const jwtSecret = process.env.JWT_SECRET;
  const insecureFallback = '369c133d44f3dd15bc3ef37fa80b8e16f0e310b180a6ceeace09dbeb16f29ebb6f9b222b50c1332d6443defd77a84daf767ac392c4e93a579049e6e65fb729c1';

  if (jwtSecret === insecureFallback) {
    console.error('FATAL: Insecure default fallback value detected for JWT_SECRET.');
    process.exit(1);
  }

  if (missingVars.length > 0) {
    console.error(`FATAL: Missing required environment variables: ${missingVars.join(', ')}`);
    process.exit(1);
  }

  console.log('✓ Environment variables successfully validated.');
};
