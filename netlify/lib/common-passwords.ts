/**
 * Common password roots.
 *
 * AUTH-SPEC section 4 asks for a common-password list. A raw list of the usual
 * top 10,000 is mostly wasted here, because nearly all of it is shorter than the
 * 12 character minimum and would be refused on length anyway. What actually gets
 * through is a common root with padding on the end — password1234, letmein2026,
 * qwerty!!!!!! — so this list holds the roots, and checkPassword() strips the
 * padding before looking them up.
 *
 * Not secret, not exhaustive, and not a substitute for the length rule. It is the
 * cheap check that catches the guess an attacker makes first.
 */
export const COMMON_PASSWORD_ROOTS: ReadonlySet<string> = new Set([
  // The perennials
  'password', 'passwords', 'passwort', 'pass', 'passw', 'passwd', 'motdepasse',
  'letmein', 'letmeinplease', 'welcome', 'welcometothejungle', 'changeme',
  'default', 'secret', 'access', 'login', 'logmein', 'admin', 'administrator',
  'root', 'guest', 'user', 'test', 'testing', 'temp', 'temporary', 'demo',
  'whatever', 'nothing', 'something', 'anything', 'iforgot', 'idontknow',
  'trustno', 'trustnoone', 'nopassword', 'thisismypassword', 'mypassword',
  'passwordpassword', 'newpassword', 'oldpassword', 'notmypassword',

  // Keyboard walks
  'qwerty', 'qwertyuiop', 'qwertyuiopasdfghjkl', 'qwertyuiopasdfghjklzxcvbnm',
  'azerty', 'azertyuiop', 'asdf', 'asdfgh', 'asdfghjkl', 'zxcvbn', 'zxcvbnm',
  'qazwsx', 'qazwsxedc', 'qwer', 'qweasd', 'qweasdzxc', 'poiuytrewq',
  'mnbvcxz', 'lkjhgfdsa', 'zaqwsx', 'wasd', 'yxcvbnm',

  // Digit runs and repeats that survive a length check
  '123456', '1234567', '12345678', '123456789', '1234567890', '12345678910',
  '123456789012', '1234512345', '123123123', '112233445566', '121212121212',
  '111111111111', '000000000000', '999999999999', '696969696969',
  '147258369', '159753', '987654321', '0987654321', '1029384756',
  '11223344', '123321123321', '456456456', '789789789',

  // Affection, insult and everything between
  'iloveyou', 'iloveyoutoo', 'iloveyouforever', 'iloveyousomuch', 'ihateyou',
  'loveme', 'lovely', 'lovelove', 'forever', 'foreveryoung', 'sweetheart',
  'darling', 'honey', 'babygirl', 'babyboy', 'princess', 'princesa',
  'beautiful', 'gorgeous', 'sunshine', 'moonlight', 'starlight', 'happiness',
  'freedom', 'believe', 'blessed', 'faith', 'hope', 'peace', 'family',

  // Names people actually use
  'michael', 'jennifer', 'jessica', 'ashley', 'amanda', 'samantha', 'nicole',
  'jordan', 'michelle', 'daniel', 'joshua', 'matthew', 'andrew', 'charlie',
  'thomas', 'robert', 'william', 'anthony', 'nicholas', 'christopher',
  'alexander', 'benjamin', 'elizabeth', 'katherine', 'stephanie', 'patrick',
  'mohammed', 'muhammad', 'ahmed', 'fatima', 'hussain', 'abdullah',

  // Characters and creatures
  'monkey', 'dragon', 'tigger', 'snoopy', 'shadow', 'ranger', 'hunter',
  'buster', 'killer', 'ginger', 'cookie', 'peanut', 'pepper', 'bailey',
  'maggie', 'sophie', 'oliver', 'dolphin', 'phoenix', 'falcon',
  'superman', 'batman', 'spiderman', 'ironman', 'wolverine', 'gandalf',
  'starwars', 'startrek', 'pokemon', 'pikachu', 'minecraft', 'fortnite',
  'zelda', 'mario', 'sonic', 'skywalker', 'darthvader',

  // Sport and music
  'football', 'baseball', 'basketball', 'soccer', 'hockey', 'cricket',
  'liverpool', 'chelsea', 'arsenal', 'tottenham', 'manchester',
  'manchesterunited', 'realmadrid', 'barcelona', 'juventus', 'rangers',
  'celtic', 'blink', 'metallica', 'nirvana', 'slipknot', 'greenday',
  'linkinpark', 'eminem', 'rihanna', 'beyonce', 'taylorswift', 'onedirection',

  // Objects, places, comforts
  'chocolate', 'computer', 'internet', 'keyboard', 'monitor', 'butterfly',
  'flower', 'garden', 'summer', 'winter', 'spring', 'autumn', 'orange',
  'purple', 'silver', 'golden', 'banana', 'cheese', 'coffee', 'whisky',
  'guinness', 'corona', 'mustang', 'corvette', 'ferrari', 'porsche',
  'harley', 'harleydavidson', 'bahrain', 'manama', 'london', 'newyork',

  // Famous by way of being famous
  'correcthorsebatterystaple', 'thequickbrownfox',
  'thequickbrownfoxjumpsoverthelazydog', 'tobeornottobe', 'hellothere',
  'helloworld', 'openthedoor', 'opensesame', 'abandonhope', 'itsasecret',
  'gandalfthegrey', 'winteriscoming', 'maytheforcebewithyou',
])
