import { SignupKeyword } from '../entities/SignupKeyword';

export interface SignupKeywordRepository {
  add(keyword: SignupKeyword): Promise<SignupKeyword>;
  findByKeyword(keyword: string): Promise<SignupKeyword | null>;
  findById(id: string): Promise<SignupKeyword | null>;
  findAllActive(): Promise<SignupKeyword[]>;
  findAll(): Promise<SignupKeyword[]>;
  update(keyword: SignupKeyword): Promise<SignupKeyword>;
  delete(id: string): Promise<void>;
}
