const request = require('supertest');
const { app } = require('../../src/index');

describe('Task CRUD Endpoints', () => {
  let token;
  let sectionId;
  let taskId;

  beforeAll(async () => {
    // 1. Register a user
    const res = await request(app).post('/api/auth/register').send({
      email: 'taskuser@example.com',
      password: 'password123',
      name: 'Task User'
    });
    token = res.body.token;

    // 2. Fetch the automatically created 'My Tasks' project to get a section
    const projectsRes = await request(app)
      .get('/api/projects')
      .set('Authorization', `Bearer ${token}`);
    
    const myTasks = projectsRes.body.find(p => p.status === 'MY_TASKS');
    sectionId = myTasks.sections[0].id;
  });

  it('should create a new task', async () => {
    const res = await request(app)
      .post('/api/projects/tasks')
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'New Integration Task',
        sectionId: sectionId
      });

    expect(res.statusCode).toEqual(201);
    expect(res.body).toHaveProperty('title', 'New Integration Task');
    expect(res.body).toHaveProperty('id');
    taskId = res.body.id;
  });

  it('should get task details (by project id/task id usually, or direct)', async () => {
    // Actually tasks are fetched with project usually, let's update a task
    const res = await request(app)
      .patch(`/api/projects/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({
        title: 'Updated Integration Task'
      });

    // We don't have a specific GET /tasks/:id endpoint without project, 
    // but PATCH returns the updated task.
    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('title', 'Updated Integration Task');
  });

  it('should delete a task', async () => {
    const res = await request(app)
      .delete(`/api/projects/tasks/${taskId}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.statusCode).toEqual(200);
    expect(res.body).toHaveProperty('message');
  });
});
