import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Company, CompanyDocument } from './schemas/company.schema.js';
import { Model } from 'mongoose';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Injectable()
export class CompaniesService {
  constructor(
    @InjectModel(Company.name)
    private readonly companyModel: Model<CompanyDocument>,
  ) {}

  private isDuplicateKeyError(error: unknown): error is { code: number } {
    return (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === 11000
    );
  }

  async getAllCompanies() {
    return this.companyModel.find().sort({ createdAt: -1 }).exec();
  }

  async getCompanyById(id: string) {
    const company = await this.companyModel.findOne({ id }).exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return company;
  }

  async createCompany(dto: CreateCompanyDto): Promise<CompanyDocument> {
    try {
      return await this.companyModel.create({
        ...dto,
        slug: dto.slug.toLowerCase().trim(),
      });
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Bunday slug bilan company mavjud');
      }
      throw error;
    }
  }

  async updateCompany(id: string, dto: UpdateCompanyDto) {
    try {
      const company = await this.companyModel
        .findOneAndUpdate(
          { id },
          {
            $set: {
              ...dto,
              ...(dto.slug ? { slug: dto.slug.toLowerCase().trim() } : {}),
            },
          },
          {
            new: true,
            runValidators: true,
          },
        )
        .exec();

      if (!company) {
        throw new NotFoundException('Company not found');
      }

      return company;
    } catch (error: unknown) {
      if (this.isDuplicateKeyError(error)) {
        throw new ConflictException('Bunday slug bilan company mavjud');
      }
      throw error;
    }
  }

  async deleteCompany(id: string) {
    const company = await this.companyModel.findOneAndDelete({ id }).exec();

    if (!company) {
      throw new NotFoundException('Company not found');
    }

    return {
      message: "Company o'chirildi",
      company,
    };
  }
}
