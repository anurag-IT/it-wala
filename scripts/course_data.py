"""
IT Wala Dai — single source of truth for the free +2 course data.

The home course cards, the /plus-two cards and the course detail pages (/plus-two/<slug>) all read
from COURSES, so title, duration, lesson count and price can never disagree between pages.
  * lessons  = sum of the module lessons (computed, never typed by hand)
  * duration = shown exactly as written
  * img      = Unsplash photo id, or a local /assets/... path
  * instructor=True shows the instructor block (Sachin Kushwaha teaches C and C++)
"""

COURSES = [
    dict(
        slug='cpp-programming', code='C++', cls='cpp', name='C++ for +2 Students', short_name='C++',
        cat='Class 11 &middot; Computer Science', audience_short='Class 11 ra Class 12 ka students',
        title='C++ for +2 Students &mdash; basics dekhi OOP samma',
        short='C++ programming ko foundation basics bata siknuhos. Programming logic, variables, data types, operators, '
              'conditions, loops, functions ra aru important concepts step-by-step bujhdai practical coding practice garnuhos.',
        img='1555066931-4365d14bab8c', level='Beginner', duration='25 hours', instructor=True,
        home_cta='Free ma Sikna Suru Garnuhos',
        goals=['C++ program lekhna, compile ra run garna', 'Variables, data types ra operators bujhna',
               'if-else, switch ra loops bata programming logic banauna', 'Arrays ra strings sanga kaam garna',
               'Functions banauna ra function overloading bujhna', 'Classes ra objects ko basic concept bujhna',
               'Constructors, inheritance ra polymorphism ko suruwat garna', 'Euta sano mini project aafai banauna'],
        skills=['C++', 'Programming Logic', 'Problem Solving', 'Conditions &amp; Loops', 'Arrays &amp; Strings',
                'Functions', 'OOP Basics', 'File I/O', 'Debugging', 'Mini Project'],
        desc=['Yo course Class 11 ka Computer Science students lai dhyan ma rakhera banaieko ho &mdash; programming pahilo choti '
              'sikdai hunuhunchha bhane pani basics bata suru garna saknuhunchha. Class 12 ma OOP padhdai gareka students lai pani '
              'yo course ko pachhillo bhag kaam lagchha.',
              'Sabai classes <strong>IT Wala Dai App</strong> ma hunchhan &mdash; live class chhutyo bhane recording hernuhos, '
              'notes download garnuhos ra har chapter pachhi practice questions solve garnuhos.'],
        reqs=['Coding experience chahidaina', 'Laptop/computer ramro &mdash; phone ma online compiler pani chalchha',
              'Internet connection (live classes ka lagi)', 'Sikne icchha &mdash; baaki Dai le sambhalchha!'],
        audience=['Class 11 ka Computer Science students', 'Class 12 ma OOP ra C++ revise garna chahane students',
                  'Pahilo choti programming sikdai gareka students', 'Pachhi BSc CSIT / BIT / BCA padhna chahane students'],
        modules=[
            ('Getting Started', ['Programming ra C++ ke ho?', 'Setup: VS Code / Code::Blocks + compiler',
                                 'Pahilo program: cin, cout ra Hello World']),
            ('C++ ka Basics', ['Variables &amp; data types', 'Operators &amp; expressions', 'Input / output practice',
                               'Type conversion']),
            ('Control Flow', ['if, else-if &amp; switch', 'Loops: for, while, do-while', 'break &amp; continue',
                              'Practice: pattern printing']),
            ('Arrays &amp; Strings', ['1D ra 2D arrays', 'Strings &amp; string functions',
                                      'Practice: searching &amp; sorting']),
            ('Functions', ['Function banauna ra call garna', 'Parameters ra return values', 'Function overloading',
                           'Recursion']),
            ('OOP ko suruwat', ['Classes &amp; objects', 'Constructors &amp; destructors', 'Inheritance basics',
                                'Polymorphism ko intro']),
            ('Files &amp; Mini Project', ['File I/O with fstream', 'Mini project: student record system']),
        ],
    ),
    dict(
        slug='computer-course', code='PC', cls='pc', name='Complete Computer Course', short_name='Computer',
        cat='Class 12 &middot; Computer Course', audience_short='Computer knowledge majboot banauna chahane students',
        title='Complete Computer Course &mdash; basics dekhi practical skills samma',
        short='Computer ko basics dekhi important practical skills samma systematically siknuhos. Computer operation, files ra '
              'folders, typing, internet use, digital tools ra office productivity concepts ma aafno foundation majboot banaunuhos.',
        img='/assets/itwd/course-computer.jpg', level='Beginner', duration='40 hours', instructor=False,
        home_cta='Free Computer Course Siknuhos',
        goals=['Computer ka parts ra kaam garne tarika bujhna', 'Files ra folders systematically manage garna',
               'Sahi finger position sanga typing speed ra accuracy badhauna',
               'Internet, email ra cloud storage safe tarika le use garna',
               'Word processor ma document, letter ra CV banauna', 'Spreadsheet ma formulas, functions ra charts use garna',
               'Presentation slides design garera present garna', 'Computer ko basic problems aafai troubleshoot garna'],
        skills=['Computer Fundamentals', 'File Management', 'Typing', 'Internet &amp; Email', 'Online Safety',
                'Word Processing', 'Spreadsheets', 'Presentations', 'Digital Tools', 'Troubleshooting'],
        desc=['Yo course Class 12 ka students ra general computer knowledge majboot banauna chahane jo-sukai ka lagi ho. '
              'Computer chalaunu dekhi documents, spreadsheets ra presentations samma &mdash; har topic practical example ra '
              'practice sanga sikinchha.',
              'Sabai classes <strong>IT Wala Dai App</strong> ma hunchhan &mdash; live class, recordings, notes ra practice tasks '
              'ek thau ma. Course ko anta ma euta final project garera aafno skills check garnuhunchha.'],
        reqs=['Computer ko kunai experience chahidaina', 'Practice garna laptop/computer chahinchha',
              'Internet connection (live classes ka lagi)', 'Regular practice garne josh!'],
        audience=['Class 12 ka students', 'Computer ko basics clear garna chahane students',
                  'Office ra digital tools practical tarika le sikna chahane students',
                  '+2 pachhi IT padhne soch bhayeka students'],
        modules=[
            ('Computer Fundamentals', ['Computer ke ho ra kasari kaam garchha?', 'Hardware ra software',
                                       'Input, output ra storage devices', 'CPU, memory ra storage', 'Number system basics',
                                       'Types of computers', 'Computer chalauda safety', 'Practice quiz']),
            ('Operating System &amp; Files', ['Desktop, windows ra taskbar', 'Files ra folders banaune',
                                              'Copy, move, rename ra delete', 'File types ra extensions',
                                              'Search ra organize garne tarika', 'Software install ra uninstall',
                                              'Settings ra user accounts basics', 'Practice: aafno folder system']),
            ('Typing &amp; Keyboard', ['Keyboard layout ra finger position', 'Home row practice', 'Speed ra accuracy',
                                       'Useful shortcut keys', 'Typing practice tests', 'Practice: 10-minute typing drills']),
            ('Internet, Email &amp; Online Safety', ['Internet ra web browser', 'Ramro sanga search garne tarika',
                                                      'Email account ra email etiquette',
                                                      'Attachments pathaune ra download garne', 'Cloud storage basics',
                                                      'Strong password ra account safety', 'Phishing ra fake news pahichan',
                                                      'Practice: safe online habits']),
            ('Word Processing', ['Document banaune ra save garne', 'Text formatting', 'Paragraphs ra lists', 'Tables',
                                 'Images ra shapes', 'Page layout ra print', 'Project: letter ra CV', 'Practice tasks']),
            ('Spreadsheets', ['Rows, columns ra cells', 'Data entry ra formatting', 'Formulas ka basics',
                              'Functions: SUM, AVERAGE, MAX, MIN', 'Sorting ra filtering', 'Charts banaune',
                              'Project: marksheet', 'Practice tasks']),
            ('Presentations', ['Slides banaune', 'Design ra layout', 'Images ra charts', 'Transitions ra animations',
                               'Ramro sanga present garne tips', 'Project: mini presentation']),
            ('Digital Tools &amp; Final Project', ['Online forms ra surveys', 'Video call ra online class tools',
                                                   'PDF banaune ra share garne', 'Basic troubleshooting',
                                                   'Computer maintenance ra virus protection', 'Digital citizenship',
                                                   'Final project planning', 'Final project ra review']),
        ],
    ),
    dict(
        slug='c-programming', code='C', cls='c', name='C Programming', short_name='C',
        cat='+2 Computer Science', audience_short='Grade 11&ndash;12 ka students',
        title='C Programming &mdash; zero dekhi pointers samma',
        short='Programming ko suruwat C bata garnuhos. Variables dekhi pointers ra file handling samma &mdash; '
              'simple bhasha, live classes ra dainik practice sanga.',
        img='1515879218367-8466d910aaa4', level='Beginner', duration='~8 weeks', instructor=True,
        home_cta='Course hernuhos',
        goals=['C program lekhna, compile ra run garna', 'Variables, data types ra operators bujhna',
               'if-else, switch ra loops bata logic banauna', 'Arrays ra strings sanga kaam garna',
               'Functions ra recursion use garna', 'Pointers ko concept clear garna',
               'Structures bata aafnai data type banauna', 'Files ma data save ra read garna'],
        skills=['C Language', 'Logic Building', 'Problem Solving', 'Loops &amp; Patterns', 'Arrays',
                'Functions', 'Pointers', 'Structures', 'File Handling', 'Debugging'],
        desc=['Yo course programming pura zero bata suru garna chahane +2 students ka lagi ho. '
              'Har topic pahile simple example bata bujhaincha, ani live class ma sangai code garinchha.',
              'Sabai classes <strong>IT Wala Dai App</strong> ma hunchhan &mdash; live class chhutyo bhane recording hernuhos, '
              'notes download garnuhos ra har chapter pachhi practice questions solve garnuhos.'],
        reqs=['Coding experience chahidaina', 'Laptop/computer ramro &mdash; phone ma online compiler pani chalchha',
              'Internet connection (live classes ka lagi)', 'Sikne icchha &mdash; baaki Dai le sambhalchha!'],
        audience=['Grade 11&ndash;12 ka Computer Science students', 'Pahilo choti programming sikdai gareka students',
                  'Board exam ko C questions ko tayari garne students', 'Pachhi BSc CSIT / BIT / BCA padhna chahane students'],
        modules=[
            ('Getting Started', ['Programming ke ho ra C kina?', 'Setup: VS Code / Code::Blocks + GCC',
                                 'Pahilo program: Hello World']),
            ('C ka Basics', ['Variables &amp; data types', 'Input / Output: printf &amp; scanf',
                             'Operators &amp; expressions', 'Type conversion']),
            ('Control Flow', ['if, else-if &amp; switch', 'Loops: for, while, do-while', 'break &amp; continue',
                              'Practice: pattern printing']),
            ('Arrays &amp; Strings', ['1D arrays', '2D arrays (matrix)', 'Strings &amp; string functions',
                                      'Practice: searching &amp; sorting']),
            ('Functions', ['Function banauna ra call garna', 'Call by value vs call by reference', 'Recursion']),
            ('Pointers, Structures &amp; Files', ['Pointers ka basics', 'Pointers + arrays', 'Structures &amp; unions',
                                                   'File handling: fopen, fprintf, fscanf']),
        ],
    ),
]
COURSE_BY_SLUG = {c['slug']: c for c in COURSES}

COURSE_FAQ = [
    ('Ke course sachchai free ho?', 'Ho, pura free. Fees Rs. 0 &mdash; kunai hidden charge chhaina.'),
    ('Classes kaha hunchhan?', 'Sabai classes IT Wala Dai App ma hunchhan &mdash; live classes, recordings, notes ra practice '
                             'questions sabai app mai painchha.'),
    ('Pahile nai coding wa computer aaunu parchha?', 'Chahidaina. C++ course, C course ra Complete Computer Course &mdash; '
                                                    'sabai basics bata suru hunchhan.'),
    ('Laptop chahinchha?', 'Laptop/computer ramro hunchha. Classes phone ma pani herna saknuhunchha, tara practice ka lagi '
                            'computer bhaye sajilo hunchha.'),
    ('Kasari join garne?', '"Free ma join garnuhos" thichnuhos, form bharnuhos &mdash; WhatsApp ma Dai sanga kura garera course '
                           'ko barema clear information paunuhunchha.'),
]


def n_lessons(c):
    return sum(len(ls) for _, ls in c['modules'])


def course_url(c):
    return '/plus-two/%s' % c['slug']


def course_img(c, unsplash):
    """Local image path, or an Unsplash photo id passed through the build helper."""
    return c['img'] if c['img'].startswith('/') else unsplash(c['img'])


assert n_lessons(COURSE_BY_SLUG['cpp-programming']) == 24, 'C++ course must have 24 lessons'
assert n_lessons(COURSE_BY_SLUG['computer-course']) == 60, 'Complete Computer Course must have 60 lessons'
