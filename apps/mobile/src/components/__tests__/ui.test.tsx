import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ThemeProvider } from '@/lib/theme';
import { Badge, Button, RatingStars, VerificationBadges } from '@/components/ui';
import { StatusBadge } from './helpers';

const wrap = (ui: React.ReactElement) => render(<ThemeProvider>{ui}</ThemeProvider>);

describe('UI kit', () => {
  it('Button fires onPress and exposes a busy state while loading', async () => {
    const onPress = jest.fn();
    await wrap(<Button title="Publish" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Publish' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    await wrap(<Button title="Saving" loading />);
    expect(screen.getByRole('button', { busy: true })).toBeTruthy();
  });
  it('VerificationBadges renders only approved levels and nothing when empty', async () => {
    const { toJSON } = await wrap(<VerificationBadges badges={[]} />);
    expect(toJSON()).toBeNull();
    await wrap(<VerificationBadges badges={['business', 'location']} />);
    expect(screen.getByText(/Business Verified/)).toBeTruthy();
    expect(screen.getByText(/Location Inspected/)).toBeTruthy();
    expect(screen.queryByText(/Identity Verified/)).toBeNull();
  });
  it('RatingStars never fabricates a rating', async () => {
    await wrap(<RatingStars rating={null} count={0} />);
    expect(screen.getByText('No ratings yet')).toBeTruthy();
    await wrap(<RatingStars rating={4.5} count={12} />);
    expect(screen.getByText('4.5')).toBeTruthy();
    expect(screen.getByText('(12)')).toBeTruthy();
  });
  it('Badge renders its label', async () => {
    await wrap(<Badge label="Free Launch Mode" tone="accent" />);
    expect(screen.getByText('Free Launch Mode')).toBeTruthy();
  });
  it('RequestStatusBadge tells the viewer when it is their turn', async () => {
    await wrap(<StatusBadge status="countered" lastOfferBy="owner" viewer="advertiser" />);
    expect(screen.getByText('Your response needed')).toBeTruthy();
    await wrap(<StatusBadge status="countered" lastOfferBy="owner" viewer="owner" />);
    expect(screen.getByText('Counteroffer sent')).toBeTruthy();
    await wrap(<StatusBadge status="accepted" />);
    expect(screen.getByText('Accepted')).toBeTruthy();
  });
});
