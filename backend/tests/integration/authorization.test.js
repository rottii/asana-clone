const request = require('supertest');
const { app } = require('../../src/index');

describe('Authorization and Shared Dashboards Endpoints', () => {
  let token1, token2;
  let projectId;
  let publicToken;

  beforeAll(async () => {
    // 1. Register User 1
    let res = await request(app).post('/api/auth/register').send({
      email: 'user1@example.com',
      password: 'password123',
      name: 'User One'
    });
    token1 = res.body.token;

    // 2. Register User 2
    res = await request(app).post('/api/auth/register').send({
      email: 'user2@example.com',
      password: 'password123',
      name: 'User Two'
    });
    token2 = res.body.token;

    // 3. User 1 creates a new project
    res = await request(app)
      .post('/api/projects')
      .set('Authorization', `Bearer ${token1}`)
      .send({
        name: 'User 1 Private Project'
      });
    projectId = res.body.id;
  });

  it('should not allow User 2 to access User 1 private project', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`)
      .set('Authorization', `Bearer ${token2}`);
    
    // Assuming the API returns 403 or 404 for unauthorized access
    expect([403, 404]).toContain(res.statusCode);
  });

  it('should generate a public link for User 1 project', async () => {
    const res = await request(app)
      .post(`/api/projects/${projectId}/public-link`)
      .set('Authorization', `Bearer ${token1}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('publicToken');
    publicToken = res.body.publicToken;
  });

  it('should allow an unauthenticated customer to access the shared dashboard', async () => {
    // Notice no Authorization header is set
    const res = await request(app)
      .get(`/api/public/projects/${publicToken}/dashboard`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('id', projectId);
    expect(res.body).toHaveProperty('name', 'User 1 Private Project');
  });

  it('should block unauthenticated access to standard endpoints', async () => {
    const res = await request(app)
      .get(`/api/projects/${projectId}`);

    expect(res.statusCode).toEqual(401);
  });
});
