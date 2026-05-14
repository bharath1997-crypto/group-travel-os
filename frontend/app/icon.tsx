import { ImageResponse } from 'next/og';
import RovvyIcon from '../components/RovvyIcon';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default function Icon() {
  return new ImageResponse(
    (
      <RovvyIcon size={32} />
    ),
    {
      ...size,
    }
  );
}
