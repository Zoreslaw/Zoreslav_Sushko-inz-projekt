import { getFirestore, collection, addDoc } from '@react-native-firebase/firestore';
import User from '@/types/User';

/**
 * Creates a new random user with randomized data and saves it to Firestore.
 * Returns the new document ID.
 */
export async function createRandomUser(): Promise<string> {
    const db = getFirestore();
    const usersRef = collection(db, 'users');

    function generateRandomId(length = 9): string {
        return Math.random().toString(36).substr(2, length);
    }

    // Arrays of sample data to choose from
    const firstNames = [
        'Alice', 'Bob', 'Charlie', 'Diana', 'Eve',
        'Frank', 'Grace', 'Heidi', 'Ivan', 'Judy'
    ];
    const lastNames = [
        'Smith', 'Johnson', 'Williams', 'Jones', 'Brown',
        'Davis', 'Miller', 'Wilson', 'Moore', 'Taylor'
    ];
    const randomFirstName =
        firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLastName =
        lastNames[Math.floor(Math.random() * lastNames.length)];

    const randomNumber = Math.floor(Math.random() * 1000);
    const email = `${randomFirstName.toLowerCase()}.${randomLastName.toLowerCase()}${randomNumber}@example.com`;
      
    const photoURLs = [
        'https://i.redd.it/u791dt1oggjb1.png',
        'https://i.pinimg.com/736x/0d/c4/dd/0dc4dd7b618b03fc50e90be2dc1ccace.jpg',
        'https://i1.sndcdn.com/artworks-46Iy8SxkMaxepPTL-u5icpA-t500x500.jpg',
        'https://i.pinimg.com/736x/1e/7b/e3/1e7be3a2fb88966cc4ed6b22364e9dee.jpg',
        'https://cdn-images.dzcdn.net/images/artist/77220ccb5a36d0e5df2c9e47f2c89de4/1900x1900-000000-80-0-0.jpg',
        'https://i.pinimg.com/736x/54/e5/58/54e558799bef9dd570f990d3079b85ef.jpg',
      ];
    const photoURL = photoURLs[Math.floor(Math.random() * photoURLs.length)];
    

    // Sample data arrays
    const categories = ['Strategy', 'Action', 'RPG', 'Puzzle', 'Sports'];
    const languages = ['en', 'es', 'fr', 'de', 'ru', 'jp'];
    const genders = ['Male', 'Female', 'Other'];
    const games = ['Game A', 'Game B', 'Game C', 'Game D', 'Game E'];
    const descriptions = [
        'I love gaming and competitive play.',
        'Casual gamer looking for fun matches.',
        'Hardcore gamer with a passion for RPGs.',
        'I enjoy puzzle and strategy games.',
        'Sports games are my thing—let’s play!'
    ];

    // Utility: Pick a random item from an array
    const randomItem = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

    // Utility: Return a random subset (at least one item, up to maxItems)
    const randomSubset = <T,>(arr: T[], maxItems: number): T[] => {
        const shuffled = [...arr].sort(() => 0.5 - Math.random());
        const count = Math.floor(Math.random() * maxItems) + 1;
        return shuffled.slice(0, count);
    };

    // Generate random age between 18 and 40
    const age = Math.floor(Math.random() * (40 - 18 + 1)) + 18;

    // For preference age range: min between 18 and age, max between age and 40
    const prefMin = Math.floor(Math.random() * (age - 18 + 1)) + 18;
    const prefMax = Math.floor(Math.random() * (40 - age + 1)) + age;

    // Assemble the user profile data
    const userData: User = {
        id: generateRandomId(),
        displayName: `${randomFirstName} ${randomLastName}`,
        email: email,
        photoURL: photoURL,
        createdAt: new Date(),
        // favoriteCategory: randomItem(categories),
        languages: randomSubset(languages, 3),
        age,
        gender: randomItem(genders) as "Male" | "Female" | "Other",
        favoriteGames: randomSubset(games, 3),
        otherGames: randomSubset(games, 3),
        preferenceCategories: randomSubset(categories, 2),
        preferenceLanguages: randomSubset(languages, 2),
        preferenceAgeRange: { min: prefMin, max: prefMax },
        preferenceGender: Math.random() < 0.5 ? 'Any' : randomItem(genders) as "Male" | "Female" | "Other",
        description: randomItem(descriptions),
        liked: [],
        disliked: [],
    };

    try {
        const docRefCreated = await addDoc(usersRef, userData);
        console.log('Random user created with ID:', docRefCreated.id);
        return docRefCreated.id;
    } catch (err: any) {
        console.error('Error creating random user:', err);
        throw err;
    }
}
