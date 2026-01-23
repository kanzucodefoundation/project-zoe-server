# Unit Test Fix Templates

## For Services with CONNECTION injection

### Basic Service Template (e.g., addresses.service.spec.ts)
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service-name.service';
import { Connection, Repository } from 'typeorm';
import Entity1 from './entities/entity1.entity';
import Entity2 from './entities/entity2.entity';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockConnection: Partial<Connection>;

  beforeEach(async () => {
    const mockRepositories = {
      entity1: {
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
      entity2: {
        find: jest.fn(),
        save: jest.fn(),
      },
    };

    mockConnection = {
      getRepository: jest.fn((entity: any) => {
        if (entity === Entity1) return mockRepositories.entity1;
        if (entity === Entity2) return mockRepositories.entity2;
        return mockRepositories.entity1;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        // Add other dependencies here
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

### Services with Multiple Dependencies Template
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ServiceName } from './service-name.service';
import { Connection } from 'typeorm';
import { DependencyService1 } from './dependency1.service';
import { DependencyService2 } from './dependency2.service';

describe('ServiceName', () => {
  let service: ServiceName;
  let mockConnection: Partial<Connection>;

  beforeEach(async () => {
    mockConnection = {
      getRepository: jest.fn().mockReturnValue({
        find: jest.fn(),
        findOne: jest.fn(),
        save: jest.fn(),
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ServiceName,
        {
          provide: 'CONNECTION',
          useValue: mockConnection,
        },
        {
          provide: DependencyService1,
          useValue: { method1: jest.fn() },
        },
        {
          provide: DependencyService2,
          useValue: { method2: jest.fn() },
        },
      ],
    }).compile();

    service = module.get<ServiceName>(ServiceName);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
```

## For Controllers

### Basic Controller Template
```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { ControllerName } from './controller-name.controller';
import { ServiceName } from './service-name.service';

describe('ControllerName', () => {
  let controller: ControllerName;
  let mockService: Partial<ServiceName>;

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      findAll: jest.fn(),
      findOne: jest.fn(),
      update: jest.fn(),
      remove: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [ControllerName],
      providers: [
        {
          provide: ServiceName,
          useValue: mockService,
        },
      ],
    }).compile();

    controller = module.get<ControllerName>(ControllerName);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
```