/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import { Provider } from 'react-redux';
import Home from './src/Home';
import store from './src/store/store';
import { name as appName } from './app.json';
import Toast from 'react-native-toast-message';
import UpdateModal from './src/components/UpdateModal';

const Root = () => (
	<Provider store={store}>
		<Home />
		<Toast />
		<UpdateModal/>
	</Provider>
);

AppRegistry.registerComponent(appName, () => Root);
