import React from 'react';
import { UniversalPlayer } from '../player/UniversalPlayer';
import { UniversalPlayerProps } from '../player/types';

export const VideoPlayer: React.FC<UniversalPlayerProps> = (props) => {
  return <UniversalPlayer {...props} />;
};

export default VideoPlayer;
