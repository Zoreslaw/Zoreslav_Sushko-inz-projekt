export default interface User {
  id: string;
  displayName: string;
  email: string;
  photoUrl?: string; // Changed from photoURL to match backend
  createdAt: string; // Changed from Date to string (ISO date)

  languages: string[];
  age: number;
  gender: string; // Changed from union type to string
  favoriteGames: string[];
  otherGames: string[];
  preferenceCategories: string[];
  preferenceLanguages: string[];
  preferenceAgeMin?: number;
  preferenceAgeMax?: number;
  preferenceGender?: string;
  favoriteCategory?: string;
  description?: string;
  liked?: string[];
  disliked?: string[];
}

// For compatibility with components using photoURL
export interface UserWithPhotoURL extends Omit<User, 'photoUrl'> {
  photoURL?: string;
}