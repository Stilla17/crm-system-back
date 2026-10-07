import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { CompaniesService } from './companies.service.js';
import { CreateCompanyDto } from './dto/create-company.dto.js';
import { UpdateCompanyDto } from './dto/update-company.dto.js';

@Controller('companies')
export class CompaniesController {
    constructor(private readonly companyService: CompaniesService) { }

    @Get()
    getAllCompanies() {
        return this.companyService.getAllCompanies()
    }

    @Get(':id')
    getCompanyById(@Param('id') id: string) {
        return this.companyService.getCompanyById(id)
    }

    @Post()
    createCompany(@Body() dto: CreateCompanyDto) {
        return this.companyService.createCompany(dto)
    }

    @Patch(":id")
    updateCompany(@Param('id') id: string, @Body() dto: UpdateCompanyDto) {
        return this.companyService.updateCompany(id, dto)
    }

    @Delete(':id')
    deleteCompany(@Param('id') id: string) {
        return this.companyService.deleteCompany(id)
    }
}
