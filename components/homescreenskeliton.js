// SkeletonItem.tsx – separate component with stable animation
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

const SkeletonItem = ({ width, height, style, borderRadius = 4 }) => {
  const translateX = useRef(new Animated.Value(-width)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.timing(translateX, {
        toValue: width,
        duration: 1000,
        useNativeDriver: true,
      })
    );
    animation.start();
    return () => animation.stop();
  }, [width, translateX]);

  return (
    <View
      style={[
        {
          width,
          height,
          backgroundColor: "#E1E9EE",
          borderRadius,
          overflow: "hidden",
        },
        style,
      ]}
    >
      <Animated.View
        style={{
          width: "100%",
          height: "100%",
          transform: [{ translateX }],
        }}
      >
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.6)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFillObject}
        />
      </Animated.View>
    </View>
  );
};

export default React.memo(SkeletonItem);