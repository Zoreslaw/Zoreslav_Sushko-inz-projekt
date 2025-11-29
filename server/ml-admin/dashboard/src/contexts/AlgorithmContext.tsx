import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { mlAdminApi } from '../api/mlAdminApi';

interface AlgorithmContextType {
  currentAlgorithm: string;
  isLoading: boolean;
  refreshAlgorithm: () => Promise<void>;
}

const AlgorithmContext = createContext<AlgorithmContextType | undefined>(undefined);

export const AlgorithmProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentAlgorithm, setCurrentAlgorithm] = useState<string>('TwoTower');
  const [isLoading, setIsLoading] = useState(true);

  const refreshAlgorithm = async () => {
    try {
      const data = await mlAdminApi.getAlgorithm();
      setCurrentAlgorithm(data.algorithm || 'TwoTower');
    } catch (err) {
      console.error('Failed to fetch algorithm:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshAlgorithm();
    const interval = setInterval(refreshAlgorithm, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <AlgorithmContext.Provider value={{ currentAlgorithm, isLoading, refreshAlgorithm }}>
      {children}
    </AlgorithmContext.Provider>
  );
};

export const useAlgorithm = () => {
  const context = useContext(AlgorithmContext);
  if (context === undefined) {
    throw new Error('useAlgorithm must be used within an AlgorithmProvider');
  }
  return context;
};

