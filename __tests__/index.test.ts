import { execSync } from 'child_process';
import { join, homedir } from 'path';
import { existsSync, unlinkSync } from 'fs';
import { test } from '@jest/globals';

test('create and delete a profile', () => {
  const profileName = 'testProfile';
  const awsPath = join(homedir(), '.aws');
  const filePath = join(awsPath, profileName);

  // Create a profile
  execSync(`./index.ts add ${profileName} testId testSecret testRegion`);

  // Check that the profile was created
  expect(existsSync(filePath)).toBe(true);

  // Delete the profile
  execSync(`./index.ts remove ${profileName}`);

  // Check that the profile was deleted
  expect(existsSync(filePath)).toBe(false);
});
