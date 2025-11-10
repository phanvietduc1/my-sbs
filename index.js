/**
 * @format
 */

import React from 'react';
import { AppRegistry } from 'react-native';
import { Provider } from 'react-redux';
import TabNavigator from './src/App';
import store from './src/store/store';
import { name as appName } from './app.json';

const Root = () => (
	<Provider store={store}>
		<TabNavigator />
	</Provider>
);

AppRegistry.registerComponent(appName, () => Root);
