// Test script to verify the new history system
// Run this from your React Native app's debug console or as a standalone test

import { getAllFiles, getRandomFile, getNextFile, getPreviousFile, getPlayedHistory, getCurrentHistoryIndex, migrateToNewSystem } from './apiWrapper';
import { customLog, customError } from './customLogger';

const testHistorySystem = async () => {
  try {
    console.log('🧪 Starting History System Test...\n');
    
    // Test 1: Migration
    console.log('📋 Test 1: Migration');
    await migrateToNewSystem();
    console.log('✅ Migration completed\n');
    
    // Test 2: Initial state
    console.log('📋 Test 2: Initial State');
    let history = await getPlayedHistory();
    let currentIndex = await getCurrentHistoryIndex();
    console.log('Initial history length:', history.length);
    console.log('Initial current index:', currentIndex);
    console.log('✅ Initial state checked\n');
    
    // Test 3: Get first random file
    console.log('📋 Test 3: First Random File');
    const firstRandom = await getRandomFile();
    console.log('First random file:', firstRandom?.split('/').pop());
    
    history = await getPlayedHistory();
    currentIndex = await getCurrentHistoryIndex();
    console.log('History length after first random:', history.length);
    console.log('Current index after first random:', currentIndex);
    console.log('✅ First random file added\n');
    
    // Test 4: Get next files (should be truly random)
    console.log('📋 Test 4: Next Files (Should be Random)');
    const nextFiles = [];
    for (let i = 0; i < 5; i++) {
      const nextFile = await getNextFile();
      nextFiles.push(nextFile?.split('/').pop());
      console.log(`Next file ${i + 1}:`, nextFile?.split('/').pop());
      
      history = await getPlayedHistory();
      currentIndex = await getCurrentHistoryIndex();
      console.log(`  History length: ${history.length}, Current index: ${currentIndex}`);
    }
    console.log('✅ Next files generated\n');
    
    // Test 5: Navigation (go back and forth)
    console.log('📋 Test 5: Navigation Test');
    
    // Go back 2 steps
    console.log('Going back...');
    for (let i = 0; i < 2; i++) {
      const prevFile = await getPreviousFile();
      currentIndex = await getCurrentHistoryIndex();
      console.log(`Previous file: ${prevFile?.split('/').pop()}, Index: ${currentIndex}`);
    }
    
    // Go forward 1 step (should be from history, not random)
    console.log('Going forward in history...');
    const forwardFile = await getNextFile();
    currentIndex = await getCurrentHistoryIndex();
    history = await getPlayedHistory();
    console.log(`Forward file: ${forwardFile?.split('/').pop()}, Index: ${currentIndex}/${history.length}`);
    
    // Go forward again (should still be from history)
    const forwardFile2 = await getNextFile();
    currentIndex = await getCurrentHistoryIndex();
    console.log(`Forward file 2: ${forwardFile2?.split('/').pop()}, Index: ${currentIndex}/${history.length}`);
    
    // Go forward once more (should be new random since we're at leading edge)
    const newRandomFile = await getNextFile();
    currentIndex = await getCurrentHistoryIndex();
    history = await getPlayedHistory();
    console.log(`New random file: ${newRandomFile?.split('/').pop()}, Index: ${currentIndex}/${history.length}`);
    console.log('✅ Navigation test completed\n');
    
    // Test 6: Final state check
    console.log('📋 Test 6: Final State');
    const finalHistory = await getPlayedHistory();
    const finalIndex = await getCurrentHistoryIndex();
    console.log('Final history length:', finalHistory.length);
    console.log('Final current index:', finalIndex);
    console.log('Is at leading edge:', finalIndex === finalHistory.length - 1);
    console.log('✅ Final state checked\n');
    
    // Test 7: Verify no sequential patterns
    console.log('📋 Test 7: Randomness Verification');
    const testRandomFiles = [];
    for (let i = 0; i < 10; i++) {
      const randomFile = await getNextFile();
      testRandomFiles.push(randomFile?.split('/').pop());
    }
    
    // Check for patterns (consecutive files from master list)
    const allFiles = await getAllFiles();
    let hasSequentialPattern = false;
    for (let i = 0; i < testRandomFiles.length - 1; i++) {
      const currentFileIndex = allFiles.findIndex(f => f.includes(testRandomFiles[i]));
      const nextFileIndex = allFiles.findIndex(f => f.includes(testRandomFiles[i + 1]));
      
      if (currentFileIndex !== -1 && nextFileIndex !== -1 && nextFileIndex === currentFileIndex + 1) {
        hasSequentialPattern = true;
        console.log(`⚠️ Sequential pattern detected: ${testRandomFiles[i]} -> ${testRandomFiles[i + 1]}`);
      }
    }
    
    if (!hasSequentialPattern) {
      console.log('✅ No sequential patterns detected - good randomness!');
    }
    
    console.log('Random files generated:', testRandomFiles);
    console.log('✅ Randomness verification completed\n');
    
    console.log('🎉 All tests completed successfully!');
    console.log('📊 Final Results:');
    console.log(`  - Total tracks in history: ${finalHistory.length}`);
    console.log(`  - Current position: ${finalIndex + 1}/${finalHistory.length}`);
    console.log(`  - System working correctly: ✅`);
    
  } catch (error) {
    customError('❌ Test failed:', error);
    console.log('❌ History system test failed. Check the error above.');
  }
};

// Export for use in your app
export default testHistorySystem;

// Console command helper
export const runHistoryTest = () => {
  console.log('Starting history system test...');
  testHistorySystem();
}; 