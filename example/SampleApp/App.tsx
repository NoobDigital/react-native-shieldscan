import React from 'react';
import { StatusBar, useColorScheme, View, StyleSheet } from 'react-native';
import SampleAppScreen from './src/SampleAppScreen';

export default function App() {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <View style={styles.container}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <SampleAppScreen />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff', 
  },
});
