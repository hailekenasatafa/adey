import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Header, Screen, Text } from '@/components/ui';

/** Simple viewer for signed creative URLs (video or image). */
export default function MediaViewer() {
  const { url, kind } = useLocalSearchParams<{ url: string; kind: 'video' | 'image' }>();
  return (
    <Screen header={<Header title={kind === 'video' ? 'Video' : 'Image'} />} scroll={false} padded={false}>
      {kind === 'video' ? <Player url={url!} /> : <Image source={{ uri: url }} style={styles.media} contentFit="contain" />}
      <Text variant="caption" color="muted" center style={{ padding: 12 }}>Link expires in one hour. Download from the request if you need a copy.</Text>
    </Screen>
  );
}

function Player({ url }: { url: string }) {
  const player = useVideoPlayer(url, (p) => { p.loop = true; p.play(); });
  return <View style={styles.media}><VideoView player={player} style={StyleSheet.absoluteFill} contentFit="contain" nativeControls /></View>;
}

const styles = StyleSheet.create({ media: { flex: 1, backgroundColor: '#000' } });
