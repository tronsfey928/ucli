import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { GroupEntity } from './group.entity'

@Entity('mcp_entries')
export class McpEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'group_id' })
  groupId!: string

  @Column({ length: 100, unique: true })
  name!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @Column({ length: 10 })
  transport!: string

  @Column({ name: 'server_url', length: 2048, nullable: true })
  serverUrl!: string | null

  @Column({ type: 'text', nullable: true })
  command!: string | null

  @Column({ name: 'auth_config', type: 'text' })
  authConfig!: string

  @Column({ default: true })
  enabled!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => GroupEntity, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity
}
