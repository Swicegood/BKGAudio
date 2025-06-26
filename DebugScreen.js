import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { getLogs, clearLogs } from './customLogger';
import { getPlayedHistory, getCurrentHistoryIndex } from './apiWrapper';
import * as Clipboard from 'expo-clipboard';

const DebugScreen = ({ onClose, isTestMode, toggleTestMode, audioPlayerData }) => {
  const [logs, setLogs] = useState([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showHistoryDebug, setShowHistoryDebug] = useState(false);
  const [historyData, setHistoryData] = useState({
    currentIndex: -1,
    historyLength: 0,
    currentTrack: '',
    migrationComplete: false
  });

  const copyLogsToClipboard = () => {
    const logText = logs.map(log => `${log.timestamp} [${log.type}] ${log.message}`).join('\n');
    Clipboard.setString(logText);
  };

  const fetchLogs = async () => {
    const fetchedLogs = await getLogs();
    setLogs(fetchedLogs);
  };

  const fetchHistoryData = async () => {
    try {
      const currentIndex = await getCurrentHistoryIndex();
      const history = await getPlayedHistory();
      const currentTrack = history[currentIndex] || '';
      
      setHistoryData({
        currentIndex,
        historyLength: history.length,
        currentTrack: currentTrack.split('/').pop() || '',
        migrationComplete: audioPlayerData?.migrationComplete || false
      });
    } catch (error) {
      console.error('Error fetching history data:', error);
    }
  };

  useEffect(() => {
    fetchLogs();
    if (showHistoryDebug) {
      fetchHistoryData();
    }
  }, [showHistoryDebug]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    if (showHistoryDebug) {
      await fetchHistoryData();
    }
    setRefreshing(false);
  };

  const isAtLeadingEdge = historyData.currentIndex === historyData.historyLength - 1;
  const canGoPrevious = historyData.currentIndex > 0;
  const canGoNext = historyData.currentIndex < historyData.historyLength - 1;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Debug Panel</Text>
      
      {/* History Debug Section */}
      <TouchableOpacity 
        style={styles.sectionHeader} 
        onPress={() => setShowHistoryDebug(!showHistoryDebug)}
      >
        <Text style={styles.sectionHeaderText}>
          {showHistoryDebug ? '📉 Hide History Debug' : '📊 Show History Debug'}
        </Text>
      </TouchableOpacity>
      
      {showHistoryDebug && (
        <View style={styles.historySection}>
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Migration:</Text>
            <Text style={[styles.historyValue, { color: historyData.migrationComplete ? '#4CAF50' : '#FF9800' }]}>
              {historyData.migrationComplete ? '✅ Complete' : '⏳ Pending'}
            </Text>
          </View>
          
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Position:</Text>
            <Text style={styles.historyValue}>
              {historyData.currentIndex + 1} / {historyData.historyLength}
            </Text>
          </View>
          
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Current Track:</Text>
            <Text style={[styles.historyValue, { fontSize: 12 }]} numberOfLines={2}>
              {historyData.currentTrack || 'None'}
            </Text>
          </View>
          
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Leading Edge:</Text>
            <Text style={[styles.historyValue, { color: isAtLeadingEdge ? '#FF5722' : '#4CAF50' }]}>
              {isAtLeadingEdge ? '🎯 Yes (Next = Random)' : '📜 No (Next in History)'}
            </Text>
          </View>
          
          <View style={styles.historyRow}>
            <Text style={styles.historyLabel}>Navigation:</Text>
            <Text style={styles.historyValue}>
              ⬅️ {canGoPrevious ? 'Available' : 'Disabled'} | 
              ➡️ {canGoNext ? 'History' : 'Random'}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.refreshHistoryButton} onPress={fetchHistoryData}>
            <Text style={styles.refreshHistoryText}>🔄 Refresh History State</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Logs Section */}
      <Text style={styles.sectionTitle}>Debug Logs</Text>
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
  sectionHeader: {
    backgroundColor: '#2196F3',
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
  },
  sectionHeaderText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    marginTop: 10,
  },
  historySection: {
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    padding: 15,
    borderRadius: 8,
    marginBottom: 15,
  },
  historyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'flex-start',
  },
  historyLabel: {
    color: '#333333',
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  historyValue: {
    color: '#000000',
    fontSize: 14,
    flex: 2,
    textAlign: 'right',
  },
  refreshHistoryButton: {
    backgroundColor: '#4CAF50',
    padding: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  refreshHistoryText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
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
    flexWrap: 'wrap',
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