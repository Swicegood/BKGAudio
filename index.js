import { registerRootComponent } from 'expo';
import TrackPlayer from '@rntp/player';

import App from './App';
import { handleBackgroundEvent } from './service';
import { setupAppPlayer } from './player';

setupAppPlayer();
TrackPlayer.registerBackgroundEventHandler(() => handleBackgroundEvent);

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
