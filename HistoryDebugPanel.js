import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

const HistoryDebugPanel = ({ 
  historyIndex, 
  historyLength, 
  migrationComplete, 
  updateHistoryState,
  isVisible = false 
}) => {
  if (!isVisible) return null;

  const isAtLeadingEdge = historyIndex === historyLength - 1;
  const canGoPrevious = historyIndex > 0;
  const canGoNext = historyIndex < historyLength - 1;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>🔧 History Debug Panel</Text>
      
      <View style={styles.row}>
        <Text style={styles.label}>Migration:</Text>
        <Text style={[styles.value, { color: migrationComplete ? '#4CAF50' : '#FF9800' }]}>
          {migrationComplete ? '✅ Complete' : '⏳ Pending'}
        </Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Position:</Text>
        <Text style={styles.value}>
          {historyIndex + 1} / {historyLength}
        </Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Leading Edge:</Text>
        <Text style={[styles.value, { color: isAtLeadingEdge ? '#FF5722' : '#4CAF50' }]}>
          {isAtLeadingEdge ? '🎯 Yes (Next = Random)' : '📜 No (Next in History)'}
        </Text>
      </View>
      
      <View style={styles.row}>
        <Text style={styles.label}>Navigation:</Text>
        <Text style={styles.value}>
          ⬅️ {canGoPrevious ? 'Available' : 'Disabled'} | 
          ➡️ {canGoNext ? 'History' : 'Random'}
        </Text>
      </View>
      
      <TouchableOpacity style={styles.refreshButton} onPress={updateHistoryState}>
        <Text style={styles.refreshText}>🔄 Refresh State</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    margin: 10,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#333',
  },
  title: {
    color: '#FFD700',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  label: {
    color: '#CCCCCC',
    fontSize: 14,
    fontWeight: '600',
  },
  value: {
    color: '#FFFFFF',
    fontSize: 14,
    flex: 1,
    textAlign: 'right',
  },
  refreshButton: {
    backgroundColor: '#2196F3',
    padding: 8,
    borderRadius: 4,
    marginTop: 10,
  },
  refreshText: {
    color: '#FFFFFF',
    textAlign: 'center',
    fontSize: 12,
    fontWeight: '600',
  },
});

export default HistoryDebugPanel; 