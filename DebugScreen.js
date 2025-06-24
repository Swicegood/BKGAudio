import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { getLogs, clearLogs } from './customLogger';
import * as Clipboard from 'expo-clipboard';

const DebugScreen = ({ onClose, isTestMode, toggleTestMode }) => {
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);

  const copyLogsToClipboard = () => {
    const logText = logs.map(log => `${log.timestamp} [${log.type}] ${log.message}`).join('\n');
    Clipboard.setString(logText);
  };

  const fetchLogs = async () => {
    const fetchedLogs = await getLogs();
    setLogs(fetchedLogs);
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };



  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Logs</Text>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {logs.map((log, index) => (
          <View key={index} style={styles.logItem}>
            <Text style={styles.logTimestamp}>{log.timestamp}</Text>
            <Text style={[styles.logType, log.type === 'ERROR' && styles.errorText]}>
              [{log.type}]
            </Text>
            <Text style={styles.logMessage}>{log.message}</Text>
          </View>
        ))}
      </ScrollView>
      <View style={styles.buttonContainer}>
        <TouchableOpacity 
          style={[styles.button, isTestMode && styles.testModeButtonActive]} 
          onPress={toggleTestMode}
        >
          <Text style={styles.buttonText}>
            {isTestMode ? 'Test Mode: ON' : 'Test Mode: OFF'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={copyLogsToClipboard}>
          <Text style={styles.buttonText}>Copy Logs</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.button} onPress={onClose}>
          <Text style={styles.buttonText}>Close</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f0f0f0',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
  },
  scrollView: {
    flex: 1,
  },
  logItem: {
    marginBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#ccc',
    paddingBottom: 5,
  },
  logTimestamp: {
    fontSize: 12,
    color: '#666',
  },
  logType: {
    fontWeight: 'bold',
    marginRight: 5,
  },
  errorText: {
    color: 'red',
  },
  logMessage: {
    fontSize: 14,
    flexWrap: 'wrap',  // Allow text to wrap
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 20,
  },
  button: {
    backgroundColor: '#C68446',
    padding: 10,
    borderRadius: 5,
    width: '30%',
    alignItems: 'center',
  },
  testModeButtonActive: {
    backgroundColor: '#4CAF50',
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
  },
});

export default DebugScreen;