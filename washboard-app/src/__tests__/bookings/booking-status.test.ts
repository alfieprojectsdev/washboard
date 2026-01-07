import { describe, it, expect, beforeEach } from 'vitest';
import db from '@/lib/db';

describe('GET /api/bookings/:id/status', () => {
  beforeEach(async () => {
    await db.query('DELETE FROM bookings');
    await db.query('DELETE FROM branches');
    await db.query('DELETE FROM users');
    
    await db.query(
      'INSERT INTO branches (branch_code, branch_name, avg_service_minutes) VALUES ($1, $2, $3)',
      ['MAIN', 'Test Branch', 20]
    );
  });

  it('should return current queue position for queued booking', async () => {
    const bookingResult = await db.query(`
      INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, customer_name, status, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['MAIN', 'ABC123', 'Toyota', 'Camry', 'John Doe', 'queued', 3]);

    const booking = bookingResult.rows[0];
    
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request(`http://localhost:3000/api/bookings/${booking.id}/status`);
    const params = Promise.resolve({ id: booking.id.toString() });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(data).toMatchObject({
      status: 'queued',
      position: 3,
      inService: false,
      estimatedWaitMinutes: 40,
    });
    expect(data.queuedAt).toBeDefined();
  });

  it('should return in_service status when booking is being serviced', async () => {
    const bookingResult = await db.query(`
      INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, customer_name, status, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['MAIN', 'ABC123', 'Toyota', 'Camry', 'John Doe', 'in_service', 1]);

    const booking = bookingResult.rows[0];
    
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request(`http://localhost:3000/api/bookings/${booking.id}/status`);
    const params = Promise.resolve({ id: booking.id.toString() });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(data).toEqual({
      status: 'in_service',
      position: null,
      inService: true,
      estimatedWaitMinutes: 0,
    });
  });

  it('should return done status when booking is completed', async () => {
    const bookingResult = await db.query(`
      INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, customer_name, status, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['MAIN', 'ABC123', 'Toyota', 'Camry', 'John Doe', 'done', 1]);

    const booking = bookingResult.rows[0];
    
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request(`http://localhost:3000/api/bookings/${booking.id}/status`);
    const params = Promise.resolve({ id: booking.id.toString() });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(data).toEqual({
      status: 'done',
      position: null,
      inService: false,
      completed: true,
    });
  });

  it('should return cancelled status when booking is cancelled', async () => {
    const bookingResult = await db.query(`
      INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, customer_name, status, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['MAIN', 'ABC123', 'Toyota', 'Camry', 'John Doe', 'cancelled', 1]);

    const booking = bookingResult.rows[0];
    
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request(`http://localhost:3000/api/bookings/${booking.id}/status`);
    const params = Promise.resolve({ id: booking.id.toString() });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(data).toEqual({
      status: 'cancelled',
      position: null,
      inService: false,
      cancelled: true,
    });
  });

  it('should return 404 for non-existent booking', async () => {
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request('http://localhost:3000/api/bookings/99999/status');
    const params = Promise.resolve({ id: '99999' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(404);
    
    const data = await response.json();
    expect(data).toEqual({
      error: 'Booking not found',
      code: 'BOOKING_NOT_FOUND',
    });
  });

  it('should handle database connection failures gracefully', async () => {
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const { default: db } = await import('@/lib/db');
    const originalQuery = db.query;
    const mockQuery = jest.fn()
      .mockImplementationOnce(() => {
        throw new Error('Connection failed');
      })
      .mockImplementationOnce(() => {
        return { rows: [{ id: 1, status: 'queued', position: 1, branch_code: 'MAIN', created_at: new Date(), avg_service_minutes: 20 }] };
      });
    
    db.query = mockQuery;
    
    const request = new Request('http://localhost:3000/api/bookings/1/status');
    const params = Promise.resolve({ id: '1' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data.status).toBe('queued');
    expect(data.position).toBe(1);
  });

  it('should return 400 for invalid booking ID format', async () => {
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request('http://localhost:3000/api/bookings/invalid/status');
    const params = Promise.resolve({ id: 'invalid' });
    
    const response = await GET(request, { params });
    
    expect(response.status).toBe(400);
    
    const data = await response.json();
    expect(data).toEqual({
      error: 'Invalid booking ID format',
      code: 'INVALID_BOOKING_ID',
    });
  });

  it('should calculate estimated wait time correctly', async () => {
    await db.query(
      'UPDATE branches SET avg_service_minutes = 15 WHERE branch_code = $1',
      ['MAIN']
    );

    const bookingResult = await db.query(`
      INSERT INTO bookings (branch_code, plate, vehicle_make, vehicle_model, customer_name, status, position)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, ['MAIN', 'ABC123', 'Toyota', 'Camry', 'John Doe', 'queued', 5]);

    const booking = bookingResult.rows[0];
    
    const { GET } = await import('@/app/api/bookings/[id]/status/route');
    
    const request = new Request(`http://localhost:3000/api/bookings/${booking.id}/status`);
    const params = Promise.resolve({ id: booking.id.toString() });
    
    const response = await GET(request, { params });
    const data = await response.json();
    
    expect(data.estimatedWaitMinutes).toBe(60);
  });

  it('should handle CORS preflight requests', async () => {
    const { OPTIONS } = await import('@/app/api/bookings/[id]/status/route');
    
    const response = await OPTIONS();
    
    expect(response.status).toBe(200);
    expect(response.headers.get('Access-Control-Allow-Origin')).toBe('*');
    expect(response.headers.get('Access-Control-Allow-Methods')).toBe('GET, OPTIONS');
    expect(response.headers.get('Access-Control-Allow-Headers')).toBe('Content-Type');
  });
});