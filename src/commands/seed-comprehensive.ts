import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { ComprehensiveSeedService } from '../seed/comprehensive-seed.service';
import { Logger } from '@nestjs/common';

async function seedDatabase() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const seedService = app.get(ComprehensiveSeedService);

  try {
    Logger.log('🚀 Starting comprehensive database seeding...');

    // Check command line arguments
    const args = process.argv.slice(2);

    if (args.includes('--clear')) {
      Logger.log('🧹 Clearing existing data...');
      await seedService.clearAll();
      Logger.log('✅ Data cleared successfully');

      if (!args.includes('--seed')) {
        await app.close();
        process.exit(0);
      }
    }

    if (args.includes('--seed') || args.length === 0) {
      Logger.log('🌱 Seeding database with MirageJS-compatible data...');
      await seedService.seedAll();
      Logger.log('🎉 Seeding completed successfully!');

      Logger.log('\n📋 Available test accounts (password: password123):');
      Logger.log('   fellowship@worshipharvest.org - MC Shepherd (Phase MC)');
      Logger.log('   zone@worshipharvest.org       - Zone Leader (North Zone)');
      Logger.log(
        '   location@worshipharvest.org   - Location Pastor (Kampala)',
      );
      Logger.log('   fob@worshipharvest.org        - FOB Leader (East Africa)');
      Logger.log('   network@worshipharvest.org    - Network Leader (Africa)');
      Logger.log('   movement@worshipharvest.org   - Movement Leader (Global)');
      Logger.log(
        '   admin@worshipharvest.org      - System Admin (Full Access)',
      );
    }
  } catch (error) {
    Logger.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

// Show usage if help requested
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log(`
🌱 Comprehensive Database Seeding Tool

Usage: npm run seed:comprehensive [options]

Options:
  --seed    Seed the database with MirageJS-compatible data (default)
  --clear   Clear all existing seeded data
  --help    Show this help message

Examples:
  npm run seed:comprehensive           # Seed database
  npm run seed:comprehensive --clear   # Clear data only
  npm run seed:comprehensive --clear --seed  # Clear and re-seed

This will create:
  ✅ 7 test user accounts with different permission levels
  ✅ 6-level group hierarchy (Movement → Network → FOB → Location → Zone → Fellowship)
  ✅ 50+ realistic contacts across all locations
  ✅ 4 report types (MC Attendance, Service, Baptism, Salvation)
  ✅ 8 weeks of historical report submissions with realistic gaps
  ✅ Proper role-based permissions and group access control
  `);
  process.exit(0);
}

seedDatabase();
