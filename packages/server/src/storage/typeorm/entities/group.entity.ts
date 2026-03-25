import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, OneToMany } from 'typeorm'
import { TokenEntity } from './token.entity'
import { OASEntryEntity } from './oas-entry.entity'
import { McpEntryEntity } from './mcp-entry.entity'

@Entity('groups')
export class GroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ length: 100, unique: true })
  name!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @OneToMany(() => TokenEntity, t => t.group, { cascade: true })
  tokens!: TokenEntity[]

  @OneToMany(() => OASEntryEntity, o => o.group, { cascade: true })
  oasEntries!: OASEntryEntity[]

  @OneToMany(() => McpEntryEntity, m => m.group, { cascade: true })
  mcpEntries!: McpEntryEntity[]
}
