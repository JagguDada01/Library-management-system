require('dotenv').config();
const mongoose = require('mongoose');
const { connectDB, disconnectDB } = require('./config/db');
const User = require('./models/User');
const Book = require('./models/Book');
const Loan = require('./models/Loan');
const Request = require('./models/Request');
const { ROLES, REQUEST_STATUS, LOAN_STATUS, LOAN_DURATION_DAYS } = require('./config/constants');
const { calculateFine } = require('./utils/fineCalculator');

async function seedDatabase() {
  try {
    console.log('[Seed] Connecting to MongoDB...');
    await connectDB();

    console.log('[Seed] Dropping existing database and stale indexes...');
    await mongoose.connection.db.dropDatabase();

    console.log('[Seed] Creating librarian and member accounts...');
    const librarianPassword = process.env.SEED_LIBRARIAN_PASSWORD || 'Admin@123';
    const defaultMemberPassword = 'Member@123';

    // 1. Librarian
    const librarian = new User({
      name: 'Head Librarian Margaret',
      email: process.env.SEED_LIBRARIAN_EMAIL || 'admin@example.com',
      password: librarianPassword,
      role: ROLES.LIBRARIAN
    });
    await librarian.save();

    // 2. Members
    const members = await Promise.all([
      new User({
        name: 'Alice Johnson',
        email: 'alice@example.com',
        password: defaultMemberPassword,
        role: ROLES.MEMBER
      }).save(),
      new User({
        name: 'Bob Smith',
        email: 'bob@example.com',
        password: defaultMemberPassword,
        role: ROLES.MEMBER
      }).save(),
      new User({
        name: 'Charlie Davis',
        email: 'charlie@example.com',
        password: defaultMemberPassword,
        role: ROLES.MEMBER
      }).save()
    ]);

    const [alice, bob, charlie] = members;

    console.log('[Seed] Seeding book catalog...');
    const booksData = [
      {
        title: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        author: 'Robert C. Martin',
        ISBN: '978-0132350884',
        category: 'Computer Science',
        totalCopies: 5,
        availableCopies: 5,
        description: 'Even bad code can function. But if code is not clean, it can bring a development organization to its knees.',
        isActive: true
      },
      {
        title: 'Design Patterns: Elements of Reusable Object-Oriented Software',
        author: 'Erich Gamma, Richard Helm, Ralph Johnson, John Vlissides',
        ISBN: '978-0201633610',
        category: 'Computer Science',
        totalCopies: 4,
        availableCopies: 4,
        description: 'Capturing a wealth of experience about the design of object-oriented software by the Gang of Four.',
        isActive: true
      },
      {
        title: 'The Pragmatic Programmer: Your Journey to Mastery',
        author: 'David Thomas, Andrew Hunt',
        ISBN: '978-0135957059',
        category: 'Computer Science',
        totalCopies: 6,
        availableCopies: 6,
        description: 'One of the most significant books on software development ever written.',
        isActive: true
      },
      {
        title: 'Introduction to Algorithms (4th Edition)',
        author: 'Thomas H. Cormen, Charles E. Leiserson, Ronald L. Rivest, Clifford Stein',
        ISBN: '978-0262046305',
        category: 'Computer Science',
        totalCopies: 3,
        availableCopies: 3,
        description: 'Comprehensive, rigorous textbook covering the full breadth of modern algorithms and data structures.',
        isActive: true
      },
      {
        title: 'To Kill a Mockingbird',
        author: 'Harper Lee',
        ISBN: '978-0060935467',
        category: 'Literature',
        totalCopies: 4,
        availableCopies: 4,
        description: 'The unforgettable novel of a childhood in a sleepy Southern town and the crisis of conscience that rocked it.',
        isActive: true
      },
      {
        title: '1984',
        author: 'George Orwell',
        ISBN: '978-0451524935',
        category: 'Fiction',
        totalCopies: 5,
        availableCopies: 5,
        description: 'A startling and haunting vision of the world in totalitarian servitude under Big Brother.',
        isActive: true
      },
      {
        title: 'Sapiens: A Brief History of Humankind',
        author: 'Yuval Noah Harari',
        ISBN: '978-0062316097',
        category: 'History',
        totalCopies: 4,
        availableCopies: 4,
        description: 'One hundred thousand years ago, at least six different species of humans inhabited Earth. Yet today there is only one.',
        isActive: true
      },
      {
        title: 'Meditations',
        author: 'Marcus Aurelius',
        ISBN: '978-0140449334',
        category: 'Philosophy',
        totalCopies: 3,
        availableCopies: 3,
        description: 'Personal reflections and private notes on Stoic philosophy by the Roman emperor.',
        isActive: true
      },
      {
        title: 'A Brief History of Time',
        author: 'Stephen Hawking',
        ISBN: '978-0553380163',
        category: 'Science & Technology',
        totalCopies: 3,
        availableCopies: 3,
        description: 'A landmark volume in science writing by one of the great minds of our time.',
        isActive: true
      },
      {
        title: 'The Great Gatsby',
        author: 'F. Scott Fitzgerald',
        ISBN: '978-0743273565',
        category: 'Literature',
        totalCopies: 2,
        availableCopies: 2,
        description: 'The exemplary novel of the Jazz Age, capturing Jay Gatsby and his obsession with Daisy Buchanan.',
        isActive: true
      },
      {
        title: 'Special Rare Manuscripts (Archived)',
        author: 'Various Historical Authors',
        ISBN: '978-0000000001',
        category: 'History',
        totalCopies: 1,
        availableCopies: 1,
        description: 'Archived historical title preserved for records but not currently open for loan requests.',
        isActive: false
      }
    ];

    const books = await Book.insertMany(booksData);

    console.log('[Seed] Simulating loans (active, overdue, and historical returned)...');
    const now = new Date();

    // 1. Returned historical loan (Clean Code borrowed and returned by Alice)
    const returnedDate1 = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000);
    const issuedDate1 = new Date(now.getTime() - 24 * 24 * 60 * 60 * 1000);
    const dueDate1 = new Date(issuedDate1.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);

    await new Loan({
      book: books[0]._id,
      member: alice._id,
      issuedBy: librarian._id,
      issuedAt: issuedDate1,
      dueDate: dueDate1,
      returnedAt: returnedDate1,
      status: LOAN_STATUS.RETURNED,
      fine: 0
    }).save();

    // 2. Returned historical loan (Clean Code borrowed and returned by Bob with 2 days overdue)
    const returnedDate2 = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000);
    const issuedDate2 = new Date(now.getTime() - 21 * 24 * 60 * 60 * 1000);
    const dueDate2 = new Date(issuedDate2.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
    const overdueFine2 = calculateFine(dueDate2, returnedDate2).fine;

    await new Loan({
      book: books[0]._id,
      member: bob._id,
      issuedBy: librarian._id,
      issuedAt: issuedDate2,
      dueDate: dueDate2,
      returnedAt: returnedDate2,
      status: LOAN_STATUS.RETURNED,
      fine: overdueFine2
    }).save();

    // 3. Active on-time loan (1984 borrowed by Alice, due in 8 days)
    const issuedDate3 = new Date(now.getTime() - 6 * 24 * 60 * 60 * 1000);
    const dueDate3 = new Date(issuedDate3.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await new Loan({
      book: books[5]._id, // 1984
      member: alice._id,
      issuedBy: librarian._id,
      issuedAt: issuedDate3,
      dueDate: dueDate3,
      returnedAt: null,
      status: LOAN_STATUS.ISSUED,
      fine: 0
    }).save();
    await Book.findByIdAndUpdate(books[5]._id, { $inc: { availableCopies: -1 } });

    // 4. Active overdue loan (Sapiens borrowed by Bob, due 4 days ago)
    const issuedDate4 = new Date(now.getTime() - 18 * 24 * 60 * 60 * 1000);
    const dueDate4 = new Date(issuedDate4.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await new Loan({
      book: books[6]._id, // Sapiens
      member: bob._id,
      issuedBy: librarian._id,
      issuedAt: issuedDate4,
      dueDate: dueDate4,
      returnedAt: null,
      status: LOAN_STATUS.ISSUED,
      fine: 0
    }).save();
    await Book.findByIdAndUpdate(books[6]._id, { $inc: { availableCopies: -1 } });

    // 5. Active loan for Charlie (The Pragmatic Programmer)
    const issuedDate5 = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000);
    const dueDate5 = new Date(issuedDate5.getTime() + LOAN_DURATION_DAYS * 24 * 60 * 60 * 1000);
    await new Loan({
      book: books[2]._id,
      member: charlie._id,
      issuedBy: librarian._id,
      issuedAt: issuedDate5,
      dueDate: dueDate5,
      returnedAt: null,
      status: LOAN_STATUS.ISSUED,
      fine: 0
    }).save();
    await Book.findByIdAndUpdate(books[2]._id, { $inc: { availableCopies: -1 } });

    console.log('[Seed] Seeding book requests...');
    // Alice requested Algorithms (Pending)
    await new Request({
      book: books[3]._id,
      member: alice._id,
      status: REQUEST_STATUS.PENDING,
      requestedAt: new Date(now.getTime() - 1 * 60 * 60 * 1000)
    }).save();

    // Bob requested Meditations (Pending)
    await new Request({
      book: books[7]._id,
      member: bob._id,
      status: REQUEST_STATUS.PENDING,
      requestedAt: new Date(now.getTime() - 3 * 60 * 60 * 1000)
    }).save();

    // Charlie requested To Kill a Mockingbird (Rejected previously)
    await new Request({
      book: books[4]._id,
      member: charlie._id,
      status: REQUEST_STATUS.REJECTED,
      requestedAt: new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000),
      processedAt: new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000),
      processedBy: librarian._id,
      rejectionReason: 'Member reached temporary circulation limit.'
    }).save();

    console.log('---------------------------------------------------------');
    console.log('✅ Database seeded successfully!');
    console.log('👤 Librarian Account:');
    console.log(`   Email:    ${librarian.email}`);
    console.log(`   Password: ${librarianPassword}`);
    console.log('👤 Sample Member Account:');
    console.log(`   Email:    alice@example.com`);
    console.log(`   Password: ${defaultMemberPassword}`);
    console.log('---------------------------------------------------------');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seed] Error seeding database:', err);
    await disconnectDB();
    process.exit(1);
  }
}

if (require.main === module) {
  seedDatabase();
}

module.exports = seedDatabase;
