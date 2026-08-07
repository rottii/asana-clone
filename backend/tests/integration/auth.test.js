const request = require('supertest');
const { app } = require('../../src/index');

describe('Auth Endpoints', () => {
  it('should register a new user successfully', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test User'
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'test@example.com');
  });

  it('should fail registration with duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'test2@example.com',
      password: 'password123',
      name: 'Test User 2'
    });

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'test2@example.com',
        password: 'password123',
        name: 'Test User 2'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });

  it('should login an existing user successfully', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'login@example.com',
      password: 'password123',
      name: 'Login User'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'login@example.com',
        password: 'password123'
      });

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('token');
    expect(res.body.user).toHaveProperty('email', 'login@example.com');
  });

  it('should fail login with wrong credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'wrong@example.com',
      password: 'password123',
      name: 'Wrong User'
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({
        email: 'wrong@example.com',
        password: 'wrongpassword'
      });

    expect(res.statusCode).toEqual(400);
    expect(res.body).toHaveProperty('error');
  });
});
