import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { GroupEntity } from './group.entity'

@Entity('oas_entries')
export class OASEntryEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'group_id' })
  groupId!: string

  @Column({ length: 100, unique: true })
  name!: string

  @Column({ type: 'text', default: '' })
  description!: string

  @Column({ name: 'remote_url', length: 2048 })
  remoteUrl!: string

  @Column({ name: 'base_endpoint', length: 2048, nullable: true })
  baseEndpoint!: string | null

  @Column({ name: 'auth_type', length: 20 })
  authType!: string

  @Column({ name: 'auth_config', type: 'text' })
  authConfig!: string

  @Column({ name: 'cache_ttl', default: 3600 })
  cacheTtl!: number

  @Column({ default: true })
  enabled!: boolean

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt!: Date

  @ManyToOne(() => GroupEntity, g => g.oasEntries, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity
}
