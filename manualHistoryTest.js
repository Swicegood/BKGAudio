// Manual test for history navigation issue
import { getPreviousFile, getNextFile, getPlayedHistory, getCurrentHistoryIndex } from './apiWrapper';
import { customLog, customError } from './customLogger';

export const testHistoryNavigation = async () => {
  try {
    console.log('🔍 Manual History Navigation Test');
    
    // Check current state
    const currentIndex = await getCurrentHistoryIndex();
    const history = await getPlayedHistory();
    
    console.log('📊 Current State:');
    console.log('  - Current Index:', currentIndex);
    console.log('  - History Length:', history.length);
    console.log('  - Current Track:', history[currentIndex]?.split('/').pop());
    console.log('  - Can Go Previous:', currentIndex > 0);
    
    if (currentIndex > 0) {
      console.log('\n⬅️ Testing Previous File...');
      const prevFile = await getPreviousFile();
      console.log('Previous file returned:', prevFile?.split('/').pop());
      
      // Check state after
      const newIndex = await getCurrentHistoryIndex();
      const newHistory = await getPlayedHistory();
      console.log('New Index:', newIndex);
      console.log('New Current Track:', newHistory[newIndex]?.split('/').pop());
    } else {
      console.log('\n❌ Cannot test previous - already at beginning');
    }
    
    console.log('\n✅ Test completed');
    
  } catch (error) {
    customError('❌ Test failed:', error);
  }
};

// Function to show complete history for debugging
export const showCompleteHistory = async () => {
  try {
    const history = await getPlayedHistory();
    const currentIndex = await getCurrentHistoryIndex();
    
    console.log('📜 Complete History:');
    history.forEach((track, index) => {
      const indicator = index === currentIndex ? '➤' : ' ';
      console.log(`${indicator} ${index}: ${track.split('/').pop()}`);
    });
    
  } catch (error) {
    customError('❌ Error showing history:', error);
  }
}; 