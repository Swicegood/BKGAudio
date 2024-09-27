import { StyleSheet, Dimensions } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get("window");

export default StyleSheet.create({
  musicContainer: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: screenHeight * 0.4,
    width: screenWidth,
  },
  songTitleContainer: {
    height: screenHeight * 0.1,
    justifyContent: "center",
    alignItems: "center",
    width: screenWidth,
    overflow: "hidden",
  },
  songTitle: {
    fontSize: 20,
    fontWeight: "bold",
    textAlign: "center",
  },
  titleGradient: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 20,
  },
  buttonsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    width: screenWidth,
    height: screenHeight * 0.15,
  },
  button: {
    backgroundColor: "#C68446",
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
    borderRadius: 50,
    width: 70,
    height: 70,
  },
  smallButton: {
    backgroundColor: "#C68446",
    justifyContent: "center",
    alignItems: "center",
    padding: 5,
    borderRadius: 50,
    width: 50,
    height: 50,
  },
  progressContainer: {
    width: screenWidth * 0.9,
    height: 20,
    backgroundColor: '#e0e0e0',
    borderRadius: 10,
    overflow: 'hidden',
    marginBottom: 10,
  },
  progressBar: {
    height: '100%',
    backgroundColor: '#C68446',
  },
  timeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: screenWidth * 0.9,
  },
  timeText: {
    fontSize: 12,
    color: '#333',
    marginTop: 5,
  },
});