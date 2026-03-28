import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm'
import { GroupEntity } from './group.entity'

@Entity('tokens')
export class TokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'group_id' })
  groupId!: string

  @Column({ length: 200 })
  name!: string

  @Column({ length: 64, unique: true })
  jti!: string

  // Stored as comma-separated string — compatible with MySQL and PostgreSQL
  @Column({ type: 'simple-array' })
  scopes!: string[]

  @Column({ name: 'expires_at', nullable: true, type: 'datetime' })
  expiresAt!: Date | null

  @Column({ name: 'revoked_at', nullable: true, type: 'datetime' })
  revokedAt!: Date | null

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date

  @ManyToOne(() => GroupEntity, g => g.tokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'group_id' })
  group!: GroupEntity
}
