import { describe, it, expect } from 'vitest';
import { messengerHref } from '@/lib/messenger';

describe('messengerHref', () => {
  it.each([
    ['m.me/juan', 'https://m.me/juan'],
    ['fb.com/juan.dc', 'https://fb.com/juan.dc'],
    ['facebook.com/juan', 'https://facebook.com/juan'],
    ['https://m.me/juan', 'https://m.me/juan'],
    ['http://www.facebook.com/juan', 'https://www.facebook.com/juan'],
    ['  M.ME/Juan  ', 'https://m.me/Juan'],
    ['facebook.com/profile.php?id=100012345', 'https://facebook.com/profile.php?id=100012345'],
    ['web.facebook.com/juan', 'https://web.facebook.com/juan'],
    ['messenger.com/t/juan', 'https://messenger.com/t/juan'],
  ])('links %s', (handle, expected) => {
    expect(messengerHref(handle)).toBe(expected);
  });

  it.each([
    [null],
    [''],
    ['   '],
    // A name or bare username: not linked, so a guess never messages a stranger.
    ['Juan Dela Cruz'],
    ['john.doe'],
    ['@juan'],
    // Look-alike and non-Facebook hosts.
    ['evilfacebook.com/juan'],
    ['facebook.com.evil.example/juan'],
    ['https://facebook.com@evil.example/juan'],
    ['//evil.example/juan'],
    // Other schemes.
    ['javascript:alert(1)'],
    ['JavaScript:alert(1)//m.me/x'],
    ['data:text/html,hi'],
    // A domain on its own names nobody.
    ['facebook.com'],
    ['https://m.me/'],
  ])('does not link %s', (handle) => {
    expect(messengerHref(handle)).toBeNull();
  });
});
