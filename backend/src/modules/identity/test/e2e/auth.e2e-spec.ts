import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, HttpStatus } from '@nestjs/common';
import { TypeOrmModule, getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as request from 'supertest';
import { IdentityModule } from '../../identity.module';
import { UserEntity } from '../../adapters/persistence/User.entity';
import { TeamEntity } from '../../adapters/persistence/Team.entity';
import { TeamRosterEntity } from '../../adapters/persistence/TeamRoster.entity';
import { IUserRepositoryPort, IUserRepositoryPortToken } from '../../ports/outbound/IUserRepositoryPort';
import { ITeamRepositoryPort, ITeamRepositoryPortToken } from '../../ports/outbound/ITeamRepositoryPort';
import { User } from '../../domain/models/User';
import { OfficialTeam, TeamRoster } from '../../domain/models/Team';
import { GlobalExceptionFilter } from '../../../../shared/filters/global-exception.filter';
import { JwtHelper } from '../../domain/services/JwtHelper';

describe('Identity Module Integration & E2E Tests (Supertest + TypeORM SQLite)', () => {
  jest.setTimeout(30000);
  let app: INestApplication;
  let moduleFixture: TestingModule;
  let userPort: IUserRepositoryPort;
  let teamPort: ITeamRepositoryPort;
  
  // Directly retrieve database repositories to verify DB-level persistence
  let userRepo: Repository<UserEntity>;
  let teamRepo: Repository<TeamEntity>;
  let rosterRepo: Repository<TeamRosterEntity>;

  const jwtSecret = process.env.JWT_SECRET || 'gamehub_super_secret_key_12345';

  beforeAll(async () => {
    moduleFixture = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'sqlite',
          database: ':memory:',
          entities: [UserEntity, TeamEntity, TeamRosterEntity],
          synchronize: true,
          logging: false,
        }),
        IdentityModule,
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();

    userPort = moduleFixture.get<IUserRepositoryPort>(IUserRepositoryPortToken);
    teamPort = moduleFixture.get<ITeamRepositoryPort>(ITeamRepositoryPortToken);
    userRepo = moduleFixture.get<Repository<UserEntity>>(getRepositoryToken(UserEntity));
    teamRepo = moduleFixture.get<Repository<TeamEntity>>(getRepositoryToken(TeamEntity));
    rosterRepo = moduleFixture.get<Repository<TeamRosterEntity>>(getRepositoryToken(TeamRosterEntity));
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(async () => {
    // Clear SQLite tables to ensure test isolation
    await rosterRepo.clear();
    await teamRepo.clear();
    await userRepo.clear();
  });

  describe('Database Persistence Validation', () => {
    it('should successfully map and persist entities to the SQLite database without crossing boundaries', async () => {
      const user = new User({
        id: '11111111-1111-1111-1111-111111111111',
        nusp: '87654321',
        nickname: 'poligamer',
        email: 'poli@usp.br',
        fullName: 'Poli Student',
        birthDate: new Date('2001-08-15'),
        instituteId: '33333333-3333-3333-3333-333333333333',
        courseId: '44444444-4444-4444-4444-444444444444',
        availabilityStatus: 'AVAILABLE',
        isDeleted: false,
      });
      await user.updatePin('9999');

      await userPort.save(user);

      // Verify DB mapping directly
      const dbUser = await userRepo.findOneBy({ id: user.id });
      expect(dbUser).toBeDefined();
      expect(dbUser!.nusp).toBe('87654321');
      expect(dbUser!.pinHash).toContain('$argon2');

      const team = new OfficialTeam({
        id: '22222222-2222-2222-2222-222222222222',
        name: 'USP Esports',
        captainId: user.id,
        createdAt: new Date(),
        instituteId: user.instituteId,
        isActiveCompetitionTeam: true,
      });

      await teamPort.saveOfficial(team);

      const dbTeam = await teamRepo.findOneBy({ id: team.id });
      expect(dbTeam).toBeDefined();
      expect(dbTeam!.name).toBe('USP Esports');
      expect(dbTeam!.type).toBe('OFFICIAL');

      const roster = new TeamRoster({
        teamId: team.id,
        userId: user.id,
        joinedAt: new Date(),
        status: 'ACTIVE',
        seedNumber: 1,
      });

      await teamPort.saveRoster(roster);

      const dbRoster = await rosterRepo.findOneBy({ teamId: team.id, userId: user.id });
      expect(dbRoster).toBeDefined();
      expect(dbRoster!.status).toBe('ACTIVE');
      expect(dbRoster!.seedNumber).toBe(1);
    });
  });

  describe('Authentication Endpoints (POST /auth/login & /auth/refresh)', () => {
    let testUser: User;

    beforeEach(async () => {
      testUser = new User({
        id: '55555555-5555-5555-5555-555555555555',
        nusp: '12341234',
        nickname: 'johndoe',
        email: 'johndoe@usp.br',
        fullName: 'John Doe',
        birthDate: new Date('2000-02-02'),
        instituteId: '77777777-7777-7777-7777-777777777777',
        courseId: '88888888-8888-8888-8888-888888888888',
        availabilityStatus: 'OFFLINE',
        isDeleted: false,
      });
      await testUser.updatePin('5555');
      await userPort.save(testUser);
    });

    describe('User-Agent & Platform Response Formats', () => {
      it('should return access and refresh tokens in body for MOBILE clients', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .set('User-Agent', 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X)')
          .send({ nusp: '12341234', pin: '5555' })
          .expect(HttpStatus.OK);

        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.body.user).toBeDefined();
        expect(response.body.user.nusp).toBe('12341234');
        expect(response.headers['set-cookie']).toBeUndefined();
      });

      it('should return tokens in body for MOBILE clients using Custom X-Platform header', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .set('x-platform', 'capacitor')
          .send({ nusp: '12341234', pin: '5555' })
          .expect(HttpStatus.OK);

        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeDefined();
        expect(response.headers['set-cookie']).toBeUndefined();
      });

      it('should return ONLY access token in body and set HttpOnly, SameSite=Strict cookie for WEB clients', async () => {
        const response = await request(app.getHttpServer())
          .post('/auth/login')
          .set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36')
          .send({ nusp: '12341234', pin: '5555' })
          .expect(HttpStatus.OK);

        expect(response.body.accessToken).toBeDefined();
        expect(response.body.refreshToken).toBeUndefined(); // Web client does not get refresh token in JSON
        expect(response.body.user).toBeDefined();

        const cookies = response.headers['set-cookie'];
        expect(cookies).toBeDefined();
        expect(cookies.length).toBe(1);
        expect(cookies[0]).toContain('refresh_token=');
        expect(cookies[0]).toContain('HttpOnly');
        expect(cookies[0]).toContain('SameSite=Strict');
      });
    });

    describe('Session Refresh Endpoint behavior', () => {
      it('should refresh session for mobile clients via body token', async () => {
        // First login as mobile
        const loginRes = await request(app.getHttpServer())
          .post('/auth/login')
          .set('x-platform', 'capacitor')
          .send({ nusp: '12341234', pin: '5555' });
        
        const refreshToken = loginRes.body.refreshToken;

        const refreshRes = await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('x-platform', 'capacitor')
          .send({ refreshToken })
          .expect(HttpStatus.OK);

        expect(refreshRes.body.accessToken).toBeDefined();
        expect(refreshRes.body.refreshToken).toBeDefined();
      });

      it('should refresh session for web clients via cookies', async () => {
        const loginRes = await request(app.getHttpServer())
          .post('/auth/login')
          .send({ nusp: '12341234', pin: '5555' });
        
        const cookies = loginRes.headers['set-cookie'];

        const refreshRes = await request(app.getHttpServer())
          .post('/auth/refresh')
          .set('Cookie', cookies)
          .expect(HttpStatus.OK);

        expect(refreshRes.body.accessToken).toBeDefined();
        expect(refreshRes.body.refreshToken).toBeUndefined();
        expect(refreshRes.headers['set-cookie']).toBeDefined();
      });
    });
  });

  describe('RBAC Enforcement (JwtAuthGuard & RolesGuard)', () => {
    let studentToken: string;
    let guestToken: string;
    let testStudent: User;

    beforeEach(async () => {
      testStudent = new User({
        id: '88888888-8888-8888-8888-888888888888',
        nusp: '88888888',
        nickname: 'student',
        email: 'student@usp.br',
        fullName: 'Student User',
        birthDate: new Date('2000-01-01'),
        instituteId: '99999999-9999-9999-9999-999999999999',
        courseId: '00000000-0000-0000-0000-000000000000',
        availabilityStatus: 'OFFLINE',
        isDeleted: false,
      });
      await testStudent.updatePin('8888');
      await userPort.save(testStudent);

      // Sign token representing a user with STUDENT role
      studentToken = JwtHelper.sign(
        {
          sub: testStudent.id,
          roles: ['STUDENT'],
          instituteId: testStudent.instituteId,
          courseId: testStudent.courseId,
        },
        jwtSecret,
        15,
      );

      // Sign token representing a user with GUEST role (which is not allowed on create teams)
      guestToken = JwtHelper.sign(
        {
          sub: testStudent.id,
          roles: ['GUEST'],
          instituteId: testStudent.instituteId,
          courseId: testStudent.courseId,
        },
        jwtSecret,
        15,
      );
    });

    it('should allow authorized actions (STUDENT role) to create official team', async () => {
      const response = await request(app.getHttpServer())
        .post('/teams/official')
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'IME Sports',
          captainId: testStudent.id,
          instituteId: testStudent.instituteId,
        })
        .expect(HttpStatus.CREATED);

      expect(response.body.id).toBeDefined();
      expect(response.body.name).toBe('IME Sports');
    });

    it('should block unauthorized actions (GUEST role) from creating official team', async () => {
      const response = await request(app.getHttpServer())
        .post('/teams/official')
        .set('Authorization', `Bearer ${guestToken}`)
        .send({
          name: 'IME Sports',
          captainId: testStudent.id,
          instituteId: testStudent.instituteId,
        })
        .expect(HttpStatus.FORBIDDEN); // RolesGuard blocks and throws ForbiddenException

      // Verify the standardized exception envelope
      expect(response.body.errorCode).toBe('FORBIDDEN');
      expect(response.body.displayMessage).toBeDefined();
      expect(response.body.timestamp).toBeDefined();
    });

    it('should block actions without any authorization token', async () => {
      const response = await request(app.getHttpServer())
        .post('/teams/official')
        .send({
          name: 'IME Sports',
          captainId: testStudent.id,
          instituteId: testStudent.instituteId,
        })
        .expect(HttpStatus.UNAUTHORIZED); // JwtAuthGuard blocks

      // Verify the standardized exception envelope
      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.displayMessage).toContain('Authorization header missing');
    });
  });

  describe('Global Error Envelope Validation', () => {
    it('should format endpoint exceptions into standard global error envelope', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ nusp: 'wrong_nusp', pin: '0000' })
        .expect(HttpStatus.UNAUTHORIZED);

      // Verify envelope schema: { errorCode, displayMessage, timestamp, details }
      expect(response.body).toHaveProperty('errorCode');
      expect(response.body).toHaveProperty('displayMessage');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body).toHaveProperty('details');

      expect(response.body.errorCode).toBe('UNAUTHORIZED');
      expect(response.body.displayMessage).toBe('Invalid NUSP or PIN');
      expect(response.body.details).toBeNull();
    });
  });
});
