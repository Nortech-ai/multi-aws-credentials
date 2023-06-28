import { execSync } from 'child_process';
import * as fs from 'fs';
describe('End-to-End Test', () => {
  const profileName = 'testProfile';
  it('should create and delete a profile', () => {
    // Create a profile
    execSync(`./index.ts add ${profileName} testId testSecret`);
    // Check if the profile was created successfully
    expect(fs.existsSync(`~/.aws/${profileName}.creds`)).toBeTruthy();
    // Delete the profile
    execSync(`./index.ts remove ${profileName}`);
    // Check if the profile was deleted successfully
    expect(fs.existsSync(`~/.aws/${profileName}.creds`)).toBeFalsy();
  });
});


